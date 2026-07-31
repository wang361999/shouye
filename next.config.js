/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['react-markdown', 'remark-gfm', 'remark-parse', 'remark-rehype', 'unified', 'micromark', 'mdast', 'rehype'],
};

module.exports = nextConfig;
