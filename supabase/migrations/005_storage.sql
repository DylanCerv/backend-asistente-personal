-- Storage bucket for audio (private, per-user folders: {user_id}/filename)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-uploads',
  'audio-uploads',
  false,
  26214400,
  ARRAY[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
    'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'video/mp4'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "audio_uploads_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "audio_uploads_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "audio_uploads_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'audio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "audio_uploads_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'audio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
