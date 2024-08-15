## Node-Secure-DNS

Node-Secure-DNS is a library written in Node.js that resolves domain names using DNS over HTTPS (DoH). This allows for more secure DNS resolution in environments where DNS requests may be subject to tampering or monitoring.

[English](./README.md) | [中文](./translations/README_zh.md)

## Key Features

Supports custom DNS over HTTPS servers.
Enables or disables the DoH feature.
Handles the resolution of IPv4 and IPv6.

## Installation

```bash
npm install node-secure-dns
```

## How to use

```javascript
import DohResolver from "node-secure-dns";

const dohResolver = new DohResolver();

// Set DoH Server
dohResolver.setDOHResolverServer([
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
]);

// Enable DoH
dohResolver.setDOHEnable(true);

// Resolve hostname
const result = await dohResolver.resolver("example.com");
console.log(result); // Print out the resolution result

// Resolve URL
const resultUrl = await dohResolver.resolverUrl("http://example.com/path");
console.log(resultUrl); // Print out the resolved URL

// Resolve IPv6 URL
const resultUrl6 = await dohResolver.resolverUrl6("http://example.com/path");
console.log(resultUrl6); // Print out the resolved URL
```

## Feedback

If you have any questions or suggestions, feel free to raise an Issue or Pull Request.
