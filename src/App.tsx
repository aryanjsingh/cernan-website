import Compass from './components/Compass'
import Floatingnavbar from './components/spectrumui/floatingnavbar'
import { ArrowUpRight } from 'lucide-react'
import ParticleField from './components/ParticleField'

export default function App() {
  return (
    <>
      <Floatingnavbar />
      <main id="top" className="hero">
        <ParticleField />
        <div className="hero-copy">
          <h1><span className="hero-title-line">Ideas, engineered.</span><span className="hero-title-line hero-title-secondary">Built to move you.</span></h1>
          <p>We research new possibilities, create thoughtful products, and engineer neural systems that automate your work and help you navigate what comes next.</p>
          <div className="hero-actions">
            <a className="hero-secondary" href="#services">Work with US <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
        </div>
        <Compass />
      </main>
    </>
  )
}
