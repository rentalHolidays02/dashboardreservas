# Setup Vercel env vars
# Ejecutar DESPUÉS de: vercel login + vercel link

$envVars = @{
  "VITE_SUPABASE_URL"                        = "https://xytbprkimsijbokcukye.supabase.co"
  "VITE_SUPABASE_ANON_KEY"                   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dGJwcmtpbXNpamJva2N1a3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDU0NTAsImV4cCI6MjA5MjUyMTQ1MH0.nO1nMgtYxQhZQsdL2YNK4VOD3vy3iV9hEa5QIj1binI"
  "VITE_GOOGLE_API_KEY"                      = "AIzaSyAU6iF2xDuxgrGv6q6Z8wQg0MkZVbFXc5M"
  "VITE_ALOJAMIENTOS_SPREADSHEET_ID"         = "1Z1qYQ2ykQG2Kq1hO9K2PdjES_OvOR2d1yKPv7MdyAa4"
  "VITE_WORKERS_SPREADSHEET_ID"              = "1ntCYcUaUvsMWD7bOCaVmEzBqnHqf09MFd6SEjwv1OWM"
  "VITE_CLEANS_SPREADSHEET_ID"               = "1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4"
  "VITE_INCIDENCIAS_SPREADSHEET_ID"          = "1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4"
  "VITE_ENTREGA_LLAVES_SPREADSHEET_ID"       = "1xSeU9XyvZIWuifWNXgR99l6qftpsRT4hg55tsZn7IE4"
  "VITE_FEEDBACK_APPS_SCRIPT_URL"            = "https://script.google.com/macros/s/AKfycbxyYUeZyQfzv2qVw6UlgIaD6eTaEqmu6XgwZV_ohJHoSTFGNTqVH_UDL0ehNtgOsSLz/exec"
  "VITE_SUPABASE_INVITACION_APPS_SCRIPT_URL" = "https://script.google.com/macros/s/AKfycbw_Mz7ZjI_1KXBA3ehRHrZYeLgLvztgYAyEQOvDbUw3qcIcyBdEzoe3VAz5O6lxYcFRPA/exec"
  "VITE_WORKERS_APPS_SCRIPT_URL"             = "https://script.google.com/macros/s/AKfycbxIfBJ2snj6cbdD7NsHD5JxUQ8qI-z1fMs4pfqWalaGBaDKGaxUWMZiNocsHtfAPawx-Q/exec"
  "VITE_INCIDENCIAS_APPS_SCRIPT_URL"         = "https://script.google.com/macros/s/AKfycbzjsh9fXb7dMBC71vvUZgEaO2EhNGzB9s6SdRLIM3yq1hSO9FG4USPwHmDAWRm9nn6pvQ/exec"
  "VITE_ENTREGA_LLAVES_APPS_SCRIPT_URL"      = "https://script.google.com/macros/s/AKfycbw8axAbMpOBPl5XK6pkmSTprKiJKaILj7HIWh1fQR73WFWraH6Ngc95c_NCbQV7uHiuGA/exec"
  "VITE_CLEANS_APPS_SCRIPT_URL"              = "https://script.google.com/macros/s/AKfycbzm72ot1nECxcBf406o--XzL2jty55cxNRrG1Nbd64YAmYU4wl7kwi842jjlybE4ErVgw/exec"
  "VITE_SUGERENCIAS_APPS_SCRIPT_URL"         = "https://script.google.com/macros/s/AKfycbxwSkhZkcyRJDpXeU960iB8cHahnbWPmPZ522zVOytqltZNIf2d_0azcM09UntQkYXe/exec"
  "VITE_SAVE_PDF_APPS_SCRIPT_URL"            = "https://script.google.com/macros/s/AKfycbyH0c4O8dQZ7di0tqhFgcokNY-oh2NN975LI67g7Q8v9nJ79XM2h_Y6JL9vwPREcks/exec"
  "VITE_GROQ_API_KEY"                        = "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"
  "VITE_PDF_FOLDER_ID"                       = "1oqpnFs26ig9rlbXM1ud2akXTu_3GA2Wu"
}

foreach ($key in $envVars.Keys) {
  $val = $envVars[$key]
  Write-Host "Añadiendo $key..." -ForegroundColor Cyan
  npx vercel env add $key production --value $val --yes --force --scope rentalholidayses-5222s-projects --token $env:VERCEL_TOKEN
}

Write-Host "`nListo. Ejecuta: vercel --prod" -ForegroundColor Green
