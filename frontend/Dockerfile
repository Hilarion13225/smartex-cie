FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* est inlined au build, pas lu au runtime -- doit donc être fourni ici (build args),
# pas via `environment:` dans docker-compose (qui n'aurait aucun effet sur un bundle statique).
ARG VITE_API_BASE_URL
ARG VITE_USE_MOCK_API=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCK_API=$VITE_USE_MOCK_API
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
