const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Puede ser la anon key o service role key, preferible service role para uploads seguros desde el backend

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('⚠️ No se han configurado SUPABASE_URL y SUPABASE_KEY en las variables de entorno. Las funciones de Storage fallarán si no hay otra configuración de disco.');
}

module.exports = supabase;
