// src/app/api/download/route.ts
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const public_id = searchParams.get('public_id');
  const resource_type = searchParams.get('resource_type');
  const filename = searchParams.get('filename');

  if (!public_id || !resource_type || !filename) {
    return new Response('Missing params', { status: 400 });
  }

  const cloudinary = await import('cloudinary');

  cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });

  const url = cloudinary.v2.url(public_id, {
    resource_type,
    secure: true,
  });

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
