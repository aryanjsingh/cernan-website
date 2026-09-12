import Compass from './components/Compass'
import Floatingnavbar from './components/spectrumui/floatingnavbar'

export default function App() {
  return (
    <>
      <Floatingnavbar />
      <main id="top" className="hero">
        <div className="hero-copy">
          <h1>CERNAN<span>.</span></h1>
          <p>We design and engineer software, intelligent systems, and automation.</p>
        </div>
        <Compass />
      </main>
    </>
  )
}
