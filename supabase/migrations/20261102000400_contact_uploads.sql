-- Files attached to the contact form (images, audio, video up to 20 MB, as on
-- the live Contact Form 7 form). Private: the browser uploads with a signed
-- URL issued by the server, and the email links to a signed download URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contact-uploads', 'contact-uploads', false, 20971520, array['image/*', 'video/*', 'audio/*']);
