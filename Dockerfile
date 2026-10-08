# Pilot Perso : serveur Node sans dépendance + Claude Code (facultatif) pour l'abonnement claude.ai
FROM node:24-slim

# Mettre à false pour une image sans Claude Code (le mode copier-coller reste disponible).
ARG INSTALL_CLAUDE=true
RUN if [ "$INSTALL_CLAUDE" = "true" ]; then \
      npm install -g @anthropic-ai/claude-code && npm cache clean --force; \
    fi

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080 \
    CLAUDE_CONFIG_DIR=/home/node/.claude

WORKDIR /app
COPY VERSION ./
COPY server ./server
COPY web ./web
RUN mkdir -p /data /home/node/.claude && chown -R node:node /data /home/node/.claude

USER node
EXPOSE 8080
VOLUME ["/data", "/home/node/.claude"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health',{headers:process.env.APP_PASSWORD?{authorization:'Basic '+Buffer.from((process.env.APP_USER||'pilot')+':'+process.env.APP_PASSWORD).toString('base64')}:{}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/server.js"]
