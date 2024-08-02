import DnsOverHttpResolver from "./utils/doh-resolver-rfc8484";
import net from "net";

function getIpFromAnswer(datas: string[]) {
  let index = datas.length - 1;
  let ip = datas[index];
  if (net.isIP(ip)) {
    return ip;
  }
  while (index-- > 0) {
    ip = datas[index];
    if (net.isIP(ip)) {
      return ip;
    }
  }
  return null;
}
class DohResolver {
  dohResolver;
  /** 用于控制实例的DOH开关状态 */
  isDOHEnable = true;

  constructor() {
    this.dohResolver = new DnsOverHttpResolver({
      maxCache: 0,
    });
  }
  //   设置安全 dns 服务器 默认为
  //   https://cloudflare-dns.com/dns-query
  //   https://dns.google/resolve
  setDOHResolverServer = (servers: string[]) => {
    this.dohResolver.setServers(servers);
  };
  setDOHEnable = (isEnable: boolean) => {
    this.isDOHEnable = isEnable;
  };
  resolverV4Host = (hostname: string) => {
    return this["dohResolver"]?.resolve4(hostname);
  };
  resolverUrl = async (targetUrl: string) => {
    if (!this.isDOHEnable) return targetUrl;
    if (!targetUrl) return targetUrl;
    const url = new URL(targetUrl);
    if (!url.hostname) return targetUrl;
    if (net.isIP(url.hostname)) return targetUrl;
    const result = await this.dohResolver.resolve4(url.hostname);
    const resultIp = getIpFromAnswer(result);
    if (!resultIp) return targetUrl;
    url.hostname = resultIp;
    url.host = "";
    return url.toString();
  };
}

export default DohResolver;
