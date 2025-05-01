import { NextResponse } from 'next/server';

export const config = {
  matcher: '/api/socket/:path*',
};

export default async function middleware(req) {
  const url = req.nextUrl.clone();
  
  // Get the path after /api/socket
  const path = url.pathname.replace('/api/socket', '');
  
  // Create the target URL
  const targetUrl = new URL(
    `/socket.io${path}${url.search}`,
    'https://marvelmusicquiz-production.up.railway.app'
  );
  
  try {
    // Use rewrite to forward the request to the Railway server
    return NextResponse.rewrite(targetUrl);
  } catch (error) {
    console.error('Socket.IO proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Socket.IO request' },
      { status: 500 }
    );
  }
} 