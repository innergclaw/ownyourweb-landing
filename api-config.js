// Optional live API endpoint for the OWNYOURWEB intake backend.
// Leave blank to use the Formspree fallback while Supabase is not deployed.
// After Supabase deploy, set this to:
// https://PROJECT_REF.supabase.co/functions/v1/ownyourweb-intake
window.OWNYOURWEB_INTAKE_ENDPOINT = window.OWNYOURWEB_INTAKE_ENDPOINT || "";

// Local Node backend fallback for development only.
window.OWNYOURWEB_AGENT_API_BASE = window.OWNYOURWEB_AGENT_API_BASE || "";
