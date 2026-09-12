import Compass from './components/Compass'
import Floatingnavbar from './components/spectrumui/floatingnavbar'
import { ArrowUpRight } from 'lucide-react'

export default function App() {
  return (
    <>
      <Floatingnavbar />
      <main id="top" className="hero">
        <div className="hero-copy">
          <h1>Ideas, engineered.<br /><span>Built to move you.</span></h1>
          <p>We research new possibilities, create thoughtful products, and engineer neural systems that automate your work and help you navigate what comes next.</p>
          <div className="hero-actions">
            <a className="hero-primary" href="#contact">Start a project <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a className="hero-secondary" href="#services">Explore services <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
        </div>
        <Compass />
      </main>
    </>
  )
}
