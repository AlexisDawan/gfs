/*
  # Sécurité de base
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  
  # Content Security Policy (STRICT)
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://nagnnlhxrpfgrrjptmcl.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://nagnnlhxrpfgrrjptmcl.supabase.co wss://nagnnlhxrpfgrrjptmcl.supabase.co https://discord.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  
  # HSTS (HTTPS obligatoire)
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Cache des assets statiques (1 an)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Pas de cache pour index.html
/index.html
  Cache-Control: public, max-age=0, must-revalidate

# Protection des fichiers de documentation
/*.md
  X-Robots-Tag: noindex
