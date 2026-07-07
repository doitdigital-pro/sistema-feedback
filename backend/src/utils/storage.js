const supabase = require('./supabase');

async function uploadToSupabase(buffer, filename, mimetype) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(filename, buffer, {
      contentType: mimetype,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

module.exports = {
  uploadToSupabase
};
