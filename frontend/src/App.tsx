import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import Cards from './pages/Cards'
import Calculator from './pages/Calculator'
import Scenarios from './pages/Scenarios'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

function Nav() {
  const { pathname } = useLocation()
  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
    >
      {label}
    </Link>
  )
  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-2">
      <span className="text-white font-bold text-lg mr-6">Credit Card Optimizer</span>
      {link('/', 'Calculator')}
      {link('/scenarios', 'Scenarios')}
      {link('/cards', 'Card Library')}
    </nav>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <Nav />
          <main className="p-6">
            <Routes>
              <Route path="/" element={<Calculator />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/cards" element={<Cards />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
