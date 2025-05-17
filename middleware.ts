import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Rutas que no requieren autenticación
  const publicRoutes = [
    '/login',
    '/api/login',
    '/api/register',
    '/register',
    '/api/auth/callback',
    '/api/auth/reset-password',
    '/reset-password',
    '/api/health',
    '/api/status',
    '/api/send-image-to-whatsapp',
    '/forgot-password',
    '/test-connection',
    '/api/config-debug'
  ]
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  
  // Rutas de API - algunas requieren autenticación, otras no
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')
  
  // APIs públicas que no requieren autenticación
  const publicApiPaths = [
    '/api/login-redirect', 
    '/api/webhook',
    '/api/status'
  ]
  const isPublicApiPath = publicApiPaths.some(path => req.nextUrl.pathname.startsWith(path))
  
  // Si es una ruta pública, permitir el acceso sin verificación
  if (isPublicRoute) {
    console.log(`[middleware] Acceso a ruta pública: ${req.nextUrl.pathname} - permitido`)
    return res
  }
  
  // Si es una API pública, permitir el acceso sin verificación
  if (isApiRoute && isPublicApiPath) {
    console.log(`[middleware] Acceso a API pública: ${req.nextUrl.pathname} - permitido`)
    return res
  }

  // IMPORTANTE: Verificar si hay un token en localStorage que indique que el usuario ya inició sesión
  // Este es un bypass para permitir el acceso al dashboard desde una redirección de login
  const authBypass = req.cookies.get('auth_bypass')
  if (authBypass && authBypass.value === 'true' && req.nextUrl.pathname === '/dashboard') {
    console.log(`[middleware] Permitiendo acceso a ${req.nextUrl.pathname} con bypass de autenticación`)
    return res
  }

  // Verificar la sesión - autenticación obligatoria para todo lo demás
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error(`[middleware] Error al obtener sesión para ${req.nextUrl.pathname}:`, error)
      // Redirigir a login en caso de error
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      redirectUrl.searchParams.set('error', 'session_error')
      return NextResponse.redirect(redirectUrl)
    }

    if (!session) {
      console.log(`[middleware] No hay sesión para ${req.nextUrl.pathname} - redirigiendo a login`)
      // Si no hay sesión, redirigir a login
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Si hay sesión y estamos tratando de acceder al dashboard, establecer la cookie de bypass
    if (req.nextUrl.pathname === '/dashboard') {
      const response = NextResponse.next()
      response.cookies.set('auth_bypass', 'true', { 
        maxAge: 60 * 60, // 1 hora
        path: '/' 
      })
      console.log(`[middleware] Estableciendo cookie de bypass para ${req.nextUrl.pathname}`)
      return response
    }

    // Verificar que tenga acceso a un negocio si no es ruta de API
    if (!isApiRoute) {
      console.log(`[middleware] Verificando acceso a negocio para ${req.nextUrl.pathname}`)
      
      // Si hay sesión, verificar si el usuario tiene acceso al negocio
      try {
        const { data: businessData, error: businessError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (businessError) {
          console.error(`[middleware] Error al verificar negocio para ${req.nextUrl.pathname}:`, businessError)
          return NextResponse.redirect(new URL('/login', req.url))
        }
        
        if (!businessData?.business_id) {
          console.error(`[middleware] Usuario ${session.user.id} no tiene negocio asociado`)
          return NextResponse.redirect(new URL('/login', req.url))
        }
        
        console.log(`[middleware] Acceso verificado para ${req.nextUrl.pathname} - usuario ${session.user.id} con negocio ${businessData.business_id}`)
      } catch (businessCheckError) {
        console.error(`[middleware] Error crítico al verificar negocio:`, businessCheckError)
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    console.log(`[middleware] Acceso permitido a ${req.nextUrl.pathname} para el usuario ${session.user.id}`)
    return res
  } catch (unexpectedError) {
    console.error(`[middleware] Error inesperado procesando ${req.nextUrl.pathname}:`, unexpectedError)
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|_next/data).*)',
  ],
} 