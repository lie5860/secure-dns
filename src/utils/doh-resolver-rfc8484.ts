import dnsPacket, {
  Packet,
  Question,
  RecordType,
  StringAnswer,
} from "dns-packet";
import Receptacle from "receptacle";
import * as undici from "undici";

import base64url from "./base64url";

const fetch = undici.fetch;
const Headers = undici.Headers;

const _getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getDnsQuery = (questions: Question[]) => {
  const packet: Packet = {
    type: "query",
    id: _getRandomInt(1, 65534),
    flags: dnsPacket.RECURSION_DESIRED,
    questions,
  };
  return packet;
};

const _getDnsWireformat = (questions: Question[]) => {
  const dnsQuery = getDnsQuery(questions);
  const dnsQueryBuf = dnsPacket.encode(dnsQuery);
  return dnsQueryBuf;
};

/**
 * Build fetch resource for request
 */
function _buildResource(
  serverResolver: string,
  hostname: string,
  type: RecordType
) {
  const dnsWireformat = _getDnsWireformat([{ name: hostname, type }]);
  const base64Result = base64url(dnsWireformat);
  return `${serverResolver}?dns=${base64Result}`;
}

/**
 * Use fetch to find the record
 */
async function _request(resource: string, signal: AbortSignal) {
  const req = await fetch(resource, {
    headers: new Headers({
      accept: "application/dns-message",
    }),
    signal,
  });
  const aBuf = await req.arrayBuffer();
  const buf = Buffer.from(aBuf);
  const res = dnsPacket.decode(buf);

  return res;
}

/**
 * Creates cache key composed by recordType and hostname
 *
 * @param {string} hostname
 * @param {string} recordType
 */
function _getCacheKey(hostname: string, recordType: string) {
  return `${recordType}_${hostname}`;
}

export type Request = (
  resource: string,
  signal: AbortSignal
) => Promise<Packet>;

interface ResolverOptions {
  maxCache?: number;
  request?: Request;
}

/**
 * DNS over HTTP resolver.
 * Uses a list of servers to resolve DNS records with HTTP requests.
 */
class Resolver {
  private readonly _cache: Receptacle<string[]>;
  private readonly _TXTcache: Receptacle<string[][]>;
  private _servers: string[];
  private readonly _request: Request;
  private _abortControllers: AbortController[];

  /**
   * @class
   * @param {object} [options]
   * @param {number} [options.maxCache = 100] - maximum number of cached dns records
   * @param {Request} [options.request] - function to return DNSJSON
   */
  constructor(options: ResolverOptions = {}) {
    this._cache = new Receptacle({ max: options?.maxCache ?? 100 });
    this._TXTcache = new Receptacle({ max: options?.maxCache ?? 100 });
    this._servers = [
      "https://cloudflare-dns.com/dns-query",
      "https://dns.google/resolve",
    ];
    this._request = options.request ?? _request;
    this._abortControllers = [];
  }

  /**
   * Cancel all outstanding DNS queries made by this resolver. Any outstanding
   * requests will be aborted and promises rejected.
   */
  cancel() {
    this._abortControllers.forEach(controller => controller.abort());
  }

  /**
   * Get an array of the IP addresses currently configured for DNS resolution.
   * These addresses are formatted according to RFC 5952. It can include a custom port.
   */
  getServers() {
    return this._servers;
  }

  /**
   * Get a shuffled array of the IP addresses currently configured for DNS resolution.
   * These addresses are formatted according to RFC 5952. It can include a custom port.
   */
  _getShuffledServers() {
    const newServers = [...this._servers];

    for (let i = newServers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * i);
      const temp = newServers[i];
      newServers[i] = <string>newServers[j];
      newServers[j] = <string>temp;
    }

    return newServers;
  }

  /**
   * Sets the IP address and port of servers to be used when performing DNS resolution.
   *
   * @param {string[]} servers - array of RFC 5952 formatted addresses.
   */
  setServers(servers: string[]) {
    this._servers = servers;
  }

  /**
   * Uses the DNS protocol to resolve the given host name into the appropriate DNS record
   *
   * @param {string} hostname - host name to resolve
   * @param {string} [rrType = 'A'] - resource record type
   */
  async resolve(hostname: string, rrType = "A") {
    switch (rrType) {
      case "A":
        return await this.resolve4(hostname);
      case "AAAA":
        return await this.resolve6(hostname);
      case "TXT":
        return await this.resolveTxt(hostname);
      default:
        throw new Error(`${rrType} is not supported`);
    }
  }

  /**
   * Uses the DNS protocol to resolve the given host name into IPv4 addresses
   *
   * @param {string} hostname - host name to resolve
   */
  async resolve4(hostname: string) {
    const recordType = "A";
    const cached = this._cache.get(_getCacheKey(hostname, recordType));
    if (cached) {
      return cached;
    }
    let aborted = false;

    for (const server of this._getShuffledServers()) {
      const controller = new AbortController();
      this._abortControllers.push(controller);

      try {
        const response = await this._request(
          _buildResource(server, hostname, recordType),
          controller.signal
        );

        if (!response?.answers) throw new Error("Response no answers!");
        const data = response.answers.map(a => (a as StringAnswer).data);
        const ttl = Math.min(
          ...response.answers.map(a => (a as StringAnswer).ttl ?? 0)
        );

        this._cache.set(_getCacheKey(hostname, recordType), data, { ttl });

        return data;
      } catch (err) {
        if (controller.signal.aborted) {
          aborted = true;
        }

        console.error(
          `${server} could not resolve ${hostname} record ${recordType}`
        );
      } finally {
        this._abortControllers = this._abortControllers.filter(
          c => c !== controller
        );
      }
    }

    if (aborted) {
      throw Object.assign(new Error("queryA ECANCELLED"), {
        code: "ECANCELLED",
      });
    }

    throw new Error(`Could not resolve ${hostname} record ${recordType}`);
  }

  /**
   * Uses the DNS protocol to resolve the given host name into IPv6 addresses
   *
   * @param {string} hostname - host name to resolve
   */
  async resolve6(hostname: string) {
    const recordType = "AAAA";
    const cached = this._cache.get(_getCacheKey(hostname, recordType));
    if (cached) {
      return cached;
    }
    let aborted = false;

    for (const server of this._getShuffledServers()) {
      const controller = new AbortController();
      this._abortControllers.push(controller);

      try {
        const response = await this._request(
          _buildResource(server, hostname, recordType),
          controller.signal
        );

        if (!response?.answers) throw new Error("Response no answers!");
        const data = response.answers.map(a => (a as StringAnswer).data);
        const ttl = Math.min(
          ...response.answers.map(a => (a as StringAnswer).ttl ?? 0)
        );

        this._cache.set(_getCacheKey(hostname, recordType), data, { ttl });

        return data;
      } catch (err) {
        if (controller.signal.aborted) {
          aborted = true;
        }

        console.error(
          `${server} could not resolve ${hostname} record ${recordType}`
        );
      } finally {
        this._abortControllers = this._abortControllers.filter(
          c => c !== controller
        );
      }
    }

    if (aborted) {
      throw Object.assign(new Error("queryAaaa ECANCELLED"), {
        code: "ECANCELLED",
      });
    }

    throw new Error(`Could not resolve ${hostname} record ${recordType}`);
  }

  /**
   * Uses the DNS protocol to resolve the given host name into a Text record
   *
   * @param {string} hostname - host name to resolve
   */
  async resolveTxt(hostname: string) {
    const recordType = "TXT";
    const cached = this._TXTcache.get(_getCacheKey(hostname, recordType));
    if (cached) {
      return cached;
    }
    let aborted = false;

    for (const server of this._getShuffledServers()) {
      const controller = new AbortController();
      this._abortControllers.push(controller);

      try {
        const response = await this._request(
          _buildResource(server, hostname, recordType),
          controller.signal
        );

        if (!response?.answers) throw new Error("Response no answers!");
        const data = response.answers.map(a => [
          (a as StringAnswer).data.replace(/['"]+/g, ""),
        ]);
        const ttl = Math.min(
          ...response.answers.map(a => (a as StringAnswer).ttl ?? 0)
        );

        this._TXTcache.set(_getCacheKey(hostname, recordType), data, { ttl });

        return data;
      } catch (err) {
        if (controller.signal.aborted) {
          aborted = true;
        }

        console.error(
          `${server} could not resolve ${hostname} record ${recordType}`
        );
      } finally {
        this._abortControllers = this._abortControllers.filter(
          c => c !== controller
        );
      }
    }

    if (aborted) {
      throw Object.assign(new Error("queryTxt ECANCELLED"), {
        code: "ECANCELLED",
      });
    }

    throw new Error(`Could not resolve ${hostname} record ${recordType}`);
  }

  clearCache() {
    this._cache.clear();
    this._TXTcache.clear();
  }
}

export default Resolver;
