const API_URL = 'http://localhost:3001/api/feedback';

export async function sendFeedback(formData) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error enviando el feedback');
    }

    return await response.json();
  } catch (error) {
    console.error('[IMGC Feedback] API Error:', error);
    throw error;
  }
}
