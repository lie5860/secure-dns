# Node-Secure-DNS

Node-Secure-DNS 是一个使用 Node.js 编写的库，其使用 DNS over HTTPS (DoH) 解析域名。这样在面对 DNS 请求可能受到篡改或监控的环境中，获取到正确的结果。

## 主要特性

- 支持自定义 DNS over HTTPS 服务器。
- 支持开启和关闭 DoH 功能。
- 支持处理 IPv4 和 IPv6 的解析。

## 安装

```bash
npm install node-secure-dns
```

## 使用方法

```javascript
import DohResolver from "node-secure-dns";

const dohResolver = new DohResolver();

// 设置 DoH 服务器
dohResolver.setDOHResolverServer([
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
]);

// 启用 DoH
dohResolver.setDOHEnable(true);

// 解析 hostname
const result = await dohResolver.resolver("example.com");
console.log(result); // 打印出解析结果

// 解析 URL
const resultUrl = await dohResolver.resolverUrl("http://example.com/path");
console.log(resultUrl); // 打印出解析后的 URL

// 解析 IPv6 URL
const resultUrl6 = await dohResolver.resolverUrl6("http://example.com/path");
console.log(resultUrl6); // 打印出解析后的 URL
```

## 反馈

如果有任何疑问或建议，欢迎提 Issue 或 Pull Request。
