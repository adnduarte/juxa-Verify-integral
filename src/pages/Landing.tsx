import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, Search, FileText, ArrowRight, CheckCircle2, 
  Zap, Users, Building2, Briefcase, BarChart3, 
  Bot, Globe, Lock, Mail, ChevronDown, Play,
  Check, Star, Download, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStatus } from '../contexts/AuthContext';

export const Landing: React.FC = () => {
  const { user } = useAuthStatus();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "¿Qué es JUXA VERIFY?",
      a: "Es una plataforma SaaS (Software as a Service) diseñada para automatizar y gestionar investigaciones socioeconómicas y validaciones de crédito mediante Inteligencia Artificial."
    },
    {
      q: "¿Cómo funciona la validación con IA?",
      a: "Nuestra IA analiza documentos (identificaciones, comprobantes, estados de cuenta) para extraer datos, verificar autenticidad y cruzar información en tiempo real, reduciendo el error humano y el tiempo de entrega."
    },
    {
      q: "¿Es seguro el manejo de datos?",
      a: "Absolutamente. Utilizamos encriptación de grado bancario y cumplimos con los estándares más estrictos de protección de datos personales para garantizar la confidencialidad de tus investigaciones."
    },
    {
      q: "¿Puedo probar la plataforma antes de comprar?",
      a: "Sí, puedes registrarte y obtener acceso a un entorno de prueba para conocer las funcionalidades antes de adquirir un paquete de créditos o suscripción."
    }
  ];

  const useCases = [
    {
      title: "Crédito B2B",
      desc: "Valida la solvencia de empresas y socios comerciales en minutos.",
      icon: Building2,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Recursos Humanos",
      desc: "Filtra candidatos con estudios socioeconómicos precisos y rápidos.",
      icon: Users,
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      title: "Validación de Proveedores",
      desc: "Asegura la integridad de tu cadena de suministro con debida diligencia.",
      icon: ShieldCheck,
      color: "bg-amber-50 text-amber-600"
    },
    {
      title: "Crédito Financiero",
      desc: "Optimiza la originación de créditos con análisis de riesgo automatizado.",
      icon: BarChart3,
      color: "bg-indigo-50 text-indigo-600"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center rounded-xl font-bold shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                JV
              </div>
              <span className="font-bold text-2xl tracking-tight text-slate-900">JUXA <span className="text-blue-600">VERIFY</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Funcionalidades</a>
              <a href="#use-cases" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Casos de Uso</a>
              <a href="#pricing" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Precios</a>
              <a href="#faq" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold rounded-full text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900">
                    Login
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5"
                  >
                    Empezar Gratis
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-400 rounded-full blur-[120px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-widest mb-8 border border-blue-100">
                <Sparkles className="w-3.5 h-3.5" /> La Nueva Era de la Investigación SaaS
              </span>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 mb-8 leading-[0.9]">
                VALIDA CON <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500">
                  INTELIGENCIA IA
                </span>
              </h1>
              <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-500 mb-12 font-medium leading-relaxed">
                Automatiza estudios socioeconómicos y validaciones de crédito con nuestra plataforma SaaS. 
                Resultados en minutos, no en días. <span className="text-slate-900 font-bold">Precisión quirúrgica, gestión total.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-300 transition-all hover:-translate-y-1 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center">
                    {user ? "Ir al Dashboard" : "Comenzar Ahora"} <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <a href="#demo" className="text-slate-600 font-bold hover:text-slate-900 transition-colors flex items-center gap-2 px-8 py-4">
                  <Play className="w-5 h-5 fill-current" /> Ver Demo Interactiva
                </a>
              </div>

              <div className="mt-20 flex flex-wrap justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <Building2 className="w-12 h-12" />
                <ShieldCheck className="w-12 h-12" />
                <Globe className="w-12 h-12" />
                <Zap className="w-12 h-12" />
                <Users className="w-12 h-12" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Demo Simulation Section */}
        <section id="demo" className="py-24 bg-slate-900 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="text-white">
                <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                  EL PROCESO <br />
                  <span className="text-blue-500 underline decoration-blue-500/30 underline-offset-8">AUTO-GESTIONADO</span>
                </h2>
                <div className="space-y-8">
                  {[
                    { step: "01", title: "Carga de Evidencia", desc: "Sube documentos o fotos directamente desde el campo o la oficina." },
                    { step: "02", title: "Análisis IA", desc: "Nuestro motor procesa, extrae y valida datos contra fuentes oficiales." },
                    { step: "03", title: "Dictamen Instantáneo", desc: "Genera el reporte final en PDF con un solo clic, listo para entrega." }
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.2 }}
                      className="flex gap-6"
                    >
                      <span className="text-blue-500 font-black text-2xl font-mono">{item.step}</span>
                      <div>
                        <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                        <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="bg-slate-800 rounded-3xl p-4 shadow-2xl border border-slate-700 aspect-video flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-slate-900 rounded-2xl p-6 relative">
                    {/* Mock UI Simulation */}
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="h-4 w-1/2 bg-slate-800 rounded animate-pulse"></div>
                      <div className="h-24 w-full border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center">
                        <Bot className="w-12 h-12 text-blue-500 animate-bounce" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-12 bg-slate-800 rounded-lg p-2">
                          <div className="h-2 w-1/2 bg-slate-700 rounded mb-2"></div>
                          <div className="h-2 w-3/4 bg-blue-500/30 rounded"></div>
                        </div>
                        <div className="h-12 bg-slate-800 rounded-lg p-2">
                          <div className="h-2 w-1/2 bg-slate-700 rounded mb-2"></div>
                          <div className="h-2 w-3/4 bg-emerald-500/30 rounded"></div>
                        </div>
                      </div>
                      <div className="h-10 w-full bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                        VALIDACIÓN COMPLETADA 100%
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-emerald-600/20 rounded-full blur-2xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section id="use-cases" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">
                SOLUCIONES POR <span className="text-blue-600">INDUSTRIA</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Diseñado para ser el motor de confianza de las empresas más exigentes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {useCases.map((useCase, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -10 }}
                  className="p-8 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-2xl hover:shadow-slate-200 transition-all duration-300"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${useCase.color}`}>
                    <useCase.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-900">{useCase.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                    {useCase.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features List Section */}
        <section id="features" className="py-32 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl font-black text-slate-900 mb-8 leading-tight">
                  FUNCIONALIDADES <br />
                  <span className="text-blue-600 italic">PREMIUM SaaS</span>
                </h2>
                <div className="grid gap-6">
                  {[
                    { title: "Dashboard en Tiempo Real", desc: "Monitorea cada investigación desde una sola pantalla." },
                    { title: "Validación de Documentos IA", desc: "Extracción automática de datos de INE, pasaportes y más." },
                    { title: "Geolocalización de Evidencia", desc: "Asegura que las fotos se tomaron en el lugar correcto." },
                    { title: "Generación de PDF Automática", desc: "Reportes profesionales con tu marca en segundos." },
                    { title: "Gestión de Usuarios y Roles", desc: "Administra investigadores, analistas y clientes." },
                    { title: "API de Integración", desc: "Conecta JUXA VERIFY con tus sistemas internos." }
                  ].map((feat, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="mt-1 bg-blue-600 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{feat.title}</h4>
                        <p className="text-sm text-slate-500">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-32 bg-slate-100 rounded-lg"></div>
                      <div className="h-8 w-8 bg-blue-600 rounded-full"></div>
                    </div>
                    <div className="h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                      <BarChart3 className="w-16 h-16 text-slate-200" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-20 bg-slate-50 rounded-xl"></div>
                      <div className="h-20 bg-slate-50 rounded-xl"></div>
                      <div className="h-20 bg-slate-50 rounded-xl"></div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-10 -right-10 bg-emerald-500 text-white p-6 rounded-3xl shadow-xl animate-bounce">
                  <Zap className="w-8 h-8" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
                INVERSIÓN POR <span className="text-blue-600">UTILIDAD</span>
              </h2>
              <p className="text-xl text-slate-500">Escala tus operaciones sin costos ocultos.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Starter */}
              <div className="p-10 rounded-[40px] border border-slate-100 bg-slate-50/50 flex flex-col">
                <h3 className="text-xl font-bold mb-2">Starter</h3>
                <p className="text-slate-500 text-sm mb-8">Para necesidades ocasionales.</p>
                <div className="mb-8">
                  <span className="text-5xl font-black text-slate-900">$499</span>
                  <span className="text-slate-500 font-bold ml-2">MXN / reporte</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {["Sin mensualidad", "Pago por reporte", "Validación IA básica", "Soporte por email"].map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3" /> {item}
                    </li>
                  ))}
                </ul>
                <Link to="/login" className="w-full py-4 px-6 bg-white border border-slate-200 text-slate-900 font-bold rounded-2xl text-center hover:bg-slate-50 transition-colors">
                  Empezar Ahora
                </Link>
              </div>

              {/* Professional */}
              <div className="p-10 rounded-[40px] border-4 border-blue-600 bg-white shadow-2xl shadow-blue-100 flex flex-col relative scale-105 z-10">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                  Más Popular
                </div>
                <h3 className="text-xl font-bold mb-2">Professional</h3>
                <p className="text-slate-500 text-sm mb-8">Para agencias en crecimiento.</p>
                <div className="mb-8">
                  <span className="text-5xl font-black text-slate-900">$349</span>
                  <span className="text-slate-500 font-bold ml-2">MXN / reporte</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {["Membresía $2,999/mes", "Incluye 10 reportes", "Validación IA avanzada", "Dashboard de analíticas", "Soporte prioritario"].map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mr-3" /> {item}
                    </li>
                  ))}
                </ul>
                <Link to="/login" className="w-full py-4 px-6 bg-blue-600 text-white font-bold rounded-2xl text-center hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                  Suscribirse Pro
                </Link>
              </div>

              {/* Enterprise */}
              <div className="p-10 rounded-[40px] border border-slate-100 bg-slate-50/50 flex flex-col">
                <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                <p className="text-slate-500 text-sm mb-8">Soluciones a medida.</p>
                <div className="mb-8">
                  <span className="text-4xl font-black text-slate-900">Custom</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {["Volumen ilimitado", "API personalizada", "White-label", "Account Manager dedicado", "SLA garantizado"].map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3" /> {item}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-4 px-6 bg-slate-900 text-white font-bold rounded-2xl text-center hover:bg-slate-800 transition-colors">
                  Contactar Ventas
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Lead Magnet Section */}
        <section className="py-24 bg-blue-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
              ¿Quieres optimizar tus procesos de validación?
            </h2>
            <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto font-medium">
              Descarga nuestra guía gratuita: <span className="font-bold">"El Futuro de la Investigación Socioeconómica con IA en 2026"</span> y descubre cómo reducir costos en un 40%.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input 
                type="email" 
                placeholder="Tu correo corporativo" 
                className="px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-blue-200 outline-none focus:ring-2 focus:ring-white/50 w-full sm:w-80 backdrop-blur-sm"
              />
              <button className="px-8 py-4 bg-white text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/20">
                <Download className="w-5 h-5" /> Descargar Guía Gratis
              </button>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-32 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-slate-900 mb-4">PREGUNTAS <span className="text-blue-600">FRECUENTES</span></h2>
              <p className="text-slate-500">Todo lo que necesitas saber sobre JUXA VERIFY.</p>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-bold text-slate-900">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {activeFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-5 text-slate-500 text-sm leading-relaxed"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white p-16 rounded-[60px] shadow-2xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-8 tracking-tighter">
                ¿LISTO PARA EL <br />
                <span className="text-blue-600">AUTODESPACHO?</span>
              </h2>
              <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto font-medium">
                Únete a los cientos de empresas que ya están transformando su validación de datos con JUXA VERIFY.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-12 py-6 text-xl font-black rounded-3xl text-white bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all hover:-translate-y-1"
              >
                Crear Mi Cuenta SaaS <ArrowRight className="ml-3 w-6 h-6" />
              </Link>
              <div className="mt-12 flex items-center justify-center gap-4 text-sm font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                  ))}
                </div>
                <span>+500 Empresas Confían en Nosotros</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-lg font-bold shadow-lg shadow-blue-100">
                  JV
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900 uppercase">JUXA VERIFY</span>
              </div>
              <p className="text-slate-500 max-w-sm leading-relaxed">
                La plataforma SaaS líder en validación inteligente de datos e investigaciones socioeconómicas impulsada por IA.
              </p>
            </div>
            <div>
              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Producto</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-medium">
                <li><a href="#features" className="hover:text-blue-600 transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-blue-600 transition-colors">Precios</a></li>
                <li><a href="#demo" className="hover:text-blue-600 transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Compañía</h4>
              <ul className="space-y-4 text-sm text-slate-500 font-medium">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Sobre Nosotros</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
            © 2026 JUXA VERIFY. Todos los derechos reservados. <span className="mx-2">|</span> Hecho con <Sparkles className="inline w-3 h-3 text-blue-500" /> para el futuro legaltech.
          </div>
        </div>
      </footer>
    </div>
  );
};
