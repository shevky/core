# shevky

![Shevky Process Flow](https://tatoglu.net/assets/images/shevky-process-flow.webp)

A minimal, dependency-light static site generator.

## Quick Start

For the quick start you should execute the following commands.

```bash
npm init -y
npm install --save-dev shevky
npm install

npx shevky --init
```

The system provides a simple blog for you. Then you can build with following commands.

```bash
npm run build
npm run dev
```

## Build Memory Setting

For large projects you can limit in-memory page buffering during build:

```json
{
  "build": {
    "pageBufferLimit": 20
  }
}
```

- `pageBufferLimit`: Number of rendered pages kept in memory before flushing to disk.
- Default: `20`
- Environment override: `SHEVKY_PAGE_BUFFER_LIMIT`

## Output Aliases

If you want to keep markdown generation (plugins/layout/meta) but publish an
additional file path, you can define build aliases:

```json
{
  "build": {
    "outputAliases": [
      { "from": "~/404/", "to": "~/404.html" },
      { "from": "~/en/404/", "to": "~/en/404.html" }
    ]
  }
}
```

- `from`: Generated page URL/path.
- `to`: Extra copied output URL/path.

## Content Root Directories

You can copy selected `src/content` directories directly to dist root:

```json
{
  "build": {
    "contentRootDirectories": [".well-known"]
  }
}
```

- Default: `[".well-known"]`
- Example: `src/content/.well-known/apple-app-site-association` -> `dist/.well-known/apple-app-site-association`

## Technical Documentation

The tech documentation is preparing for Shevky with Shevky. You will find it under [Shevky Project](https://tatoglu.net/project/shevky) page.
