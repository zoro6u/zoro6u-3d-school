# Web image: builds the app, serves it with nginx, and proxies /api to the API (SSE-safe).
# Build from the REPO ROOT (the app imports lesson data from /content):
#   docker build -f web/Dockerfile -t 3d-school-web .
# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-slim
ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
COPY web web
COPY content content
# Leave empty to call the API on the same origin (nginx proxies /api). Set to a URL if the API lives elsewhere.
ARG VITE_API_BASE=""
ENV VITE_API_BASE=${VITE_API_BASE}
RUN cd web && pnpm build

FROM ${NGINX_IMAGE}
# nginx renders templates in /etc/nginx/templates, substituting ${API_UPSTREAM}
ENV API_UPSTREAM=http://api:8000
COPY web/security-headers.conf /etc/nginx/security-headers.conf
COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
