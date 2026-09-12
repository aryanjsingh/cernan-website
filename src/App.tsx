import Compass from './components/Compass'
import Floatingnavbar from './components/spectrumui/floatingnavbar'
import { ArrowUpRight } from 'lucide-react'

export default function App() {
  return (
    <>
      <Floatingnavbar />
      <main id="top" className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">Software <span>·</span> AI systems <span>·</span> Automation</div>
          <h1>Ideas, engineered.<br /><span>Built to move you.</span></h1>
          <p>We turn ambitious ideas into software, intelligent systems, and automation—from the first prototype to the tools your business runs on.</p>
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
