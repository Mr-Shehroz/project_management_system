// src/app/api/upload/route.ts
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const cloudinary = await import('cloudinary');

  cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });

  const buffer = Buffer.from(await file.arrayBuffer());

  const ext = path.extname(file.name).replace('.', '').toLowerCase();
  const baseName = path.basename(file.name, path.extname(file.name));

  let resourceType: 'image' | 'video' | 'raw' = 'raw';

  if (file.type.startsWith('image/')) resourceType = 'image';
  else if (file.type.startsWith('video/') || file.type.startsWith('audio/'))
    resourceType = 'video'; // ⚠️ mp3 MUST be video in Cloudinary

  const publicId = `${uuidv4()}-${baseName}`;

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.v2.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: publicId,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });

  return Response.json({
    public_id: result.public_id,
    resource_type: result.resource_type,
    original_name: file.name,
    format: result.format || ext,
  });
}
