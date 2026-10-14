import { Link, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
function Home() {
  const { data, isPending, isError } = useQuery({ queryKey: ['health'], queryFn: async () => {
    const response = await fetch('/api/v1/health');
    if (!response.ok) throw new Error('API unavailable');
    return response.json();
  }, retry: false });
  return <main className="panel"><p className="eyebrow">CLIENTFLOW / PHASE 2</p><h1>Client management, organized.</h1><p>Full-stack foundation: React, Express and PostgreSQL connectivity.</p><p role="status">API: {isPending ? 'Checking…' : isError ? 'Unavailable — start the backend' : data.status}</p><Link to="/about">About this build →</Link></main>;
}
function About() { return <main className="panel"><h1>About ClientFlow</h1><p>Client, lead and task modules will be implemented in later phases.</p><Link to="/">← Home</Link></main>; }
export default function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/about" element={<About />} /><Route path="*" element={<main className="panel"><h1>Page not found</h1><Link to="/">Home</Link></main>} /></Routes>; }
