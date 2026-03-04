# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

# BASE_HREF is the Angular base-href (e.g. "/" or "/smart-access/").
# It is baked into index.html at build time by ng build --base-href.
ARG BASE_HREF=/

WORKDIR /app

# Install dependencies first — this layer is cached as long as the lock file
# does not change, which speeds up rebuilds significantly.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the source and build.
COPY . .
RUN npm run build -- --base-href="${BASE_HREF}"


# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# Remove the default nginx site so only our config is active.
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the compiled SPA from the build stage.
# The @angular/build:application builder always places browser artefacts in
# dist/<project-name>/browser/.
COPY --from=build /app/dist/smart-access-ui/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
