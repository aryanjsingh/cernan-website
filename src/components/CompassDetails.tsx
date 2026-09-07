const neuralLayers = [3, 5, 5, 3]
const neuron = (layer: number, i: number) => [-48 + layer * 32, (i - (neuralLayers[layer] - 1) / 2) * 10]

export default function CompassDetails({ index }: { index: number }) {
  if (index === 0) return <g>
    <path d="M-45,-27 H33 V-22 M-38,-32 H39 V-8" className="fine faint" />
    <rect x="-40" y="-22" width="80" height="49" rx="2" className="surface" />
    <path d="M-40,-13 H40 M-28,-13 V27" className="fine" />
    {[-34,-29,-24].map(x => <circle key={x} cx={x} cy="-17.5" r=".7" className="solid" />)}
    {[-6,2,10,18].map((y,i) => <g key={y}><rect x="-36" y={y} width="4" height="4" rx=".6" className="fine" />{i===1 && <path d={`M-35,${y+2} h2`} className="fine" />}</g>)}
    <path d="M-21,-6 H26 M-21,19 H26 M-16,-10 V22 M21,-10 V22" className="fine faint" />
    <path d="M-17,15 C-17,-8 22,23 22,-5" className="design-curve" />
    <path d="M-17,15 V-8 M22,-5 V23" className="fine faint" />
    {[[-17,15],[-17,-8],[22,-5],[22,23]].map(([x,y],i) => <g key={i}><rect x={x-1.5} y={y-1.5} width="3" height="3" className="network-node" /></g>)}
    <circle cx="3" cy="5" r="1.5" className="node-activation" />
    <g transform="translate(29 4)">
      <rect width="18" height="31" rx="2.5" className="surface" />
      <path d="M6,3 H12 M4,7 H14 V17 H4 Z M4,21 H14 M4,25 H10" className="fine" />
      <path d="M5,29 H13" className="fine faint" />
    </g>
    <path d="M-21,23 H21" pathLength="100" className="render-pass" />
  </g>

  if (index === 1) return <g>
    <path d="M-25,-19 V17 M0,-32 V4 M27,-19 V17 M0,-5 V33" className="fine faint" />
    {[18,5,-10].map((y,i) => <g key={y} transform={`translate(0 ${y})`}>
      <path d="M-25,-10 L0,-23 L27,-10 L0,4 Z L-25,-10 V-6 L0,8 L27,-6 V-10 M0,4 V8" className="surface" />
      {i===2 ? <g>
        <path d="M-12,-10 L0,-16 L13,-10 L0,-3 Z M-8,-10 L0,-14 L9,-10 L0,-6 Z" className="fine" />
        {[-1,1].map(side => <g key={side}>{Array.from({length:4},(_,j)=><path key={j} d={`M${side*(4+j*3)},${-15+j*1.5} l${side*3},-1.5 M${side*(4+j*3)},${-5-j*1.5} l${side*3},1.5`} className="fine" />)}</g>)}
      </g> : <g>
        <path d="M-14,-10 L0,-17 L16,-9 M-9,-7 L2,-13 L10,-9 M-3,-4 L7,-9" className="fine" />
        {[0,1,2,3].map(j => <path key={j} d={`M${-19+j*5},${-5+j*2.7} v2`} className="fine" />)}
      </g>}
    </g>)}
    <path d="M-30,0 H-27 L-25,-1 M27,8 H34 V-20 H29 M0,26 V34 H20 V28" className="trace" />
    <path d="M27,8 H34 V-20 H29" pathLength="100" className="signal" />
    <circle cx="29" cy="-20" r="1.5" className="network-node" />
    <circle cx="20" cy="28" r="1.5" className="node-activation" />
  </g>

  if (index === 2) return <g>
    {Array.from({length:7},(_,i) => <path key={i} d={`M${-27+i*2},${19-i*3} C${-43+i*3},${-15-i*3} ${-5+i*2},${-35+i*2} ${22-i},${-17+i} S${32-i*2},${25-i} ${5-i},${25-i*2} S${-18+i},${30-i*2} ${-27+i*2},${19-i*3} Z`} className="contour" />)}
    <path d="M-30,20 H-36 V-25 M-36,29 H33 M5,-29 V30" className="fine faint" />
    <path d="M-27,16 C-21,5 -13,13 -8,1 S5,-10 13,-6 S21,-19 27,-19" className="trace" />
    <path d="M-27,16 C-21,5 -13,13 -8,1 S5,-10 13,-6 S21,-19 27,-19" pathLength="100" className="signal" />
    {[[-27,16],[-8,1],[13,-6],[27,-19]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="2" className="network-node" /><circle cx={x} cy={y} r=".9" className="node-activation" /></g>)}
    {Array.from({length:11},(_,i)=><path key={i} d={`M${-31+i*6},29 v${i%5===0?4:2}`} className="fine" />)}
  </g>

  if (index === 3) return <g>
    {neuralLayers.slice(0,-1).flatMap((count,layer)=>Array.from({length:count},(_,n)=>Array.from({length:neuralLayers[layer+1]},(_,next)=>{
      const [x,y]=neuron(layer,n);const [xx,yy]=neuron(layer+1,next)
      return <path key={`${layer}-${n}-${next}`} d={`M${x},${y} C${x+14},${y} ${xx-14},${yy} ${xx},${yy}`} className="neural-link" />
    })))}
    {neuralLayers.flatMap((count,layer)=>Array.from({length:count},(_,n)=>{const [x,y]=neuron(layer,n);return <g key={`${layer}-${n}`}>
      <circle cx={x} cy={y} r="2.8" className="network-node" /><circle cx={x} cy={y} r="1.3" className="node-activation" style={{animationDelay:`${layer*.65+n*.1}s`}} /></g>}))}
    <path d="M0,-26 V-24 H-16 V-20 M-55,-16 V16 M55,-16 V16 M-48,27 H48" className="fine faint" />
    {Array.from({length:17},(_,i)=><path key={i} d={`M${-48+i*6},27 v${2+((i*7)%5)}`} className="fine faint" />)}
  </g>

  if (index === 4) return <g>
    <path d="M-22,-23 H-7 V-8 M-22,22 H-7 V9 M7,-8 V-24 H18 M11,0 H26 M7,9 V25 H18 M29,-19 V19" className="trace" />
    <path d="M-22,-23 H-7 V-8 M7,-8 V-24 H18 M11,0 H26 M7,9 V25 H18" pathLength="100" className="signal" />
    <path d="M-32,-18 V-8 H-16 V7 H-32 V17" className="fine faint" />
    <path d="M0,-13 L12,-6 V7 L0,14 L-12,7 V-6 Z" className="surface" />
    {[-4, 2].flatMap((x, column) => [-4, 2].map((y, row) => <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="3" height="3" rx=".5" className="fine" />
      <circle cx={x+1.5} cy={y+1.5} r=".8" className="node-activation" style={{animationDelay:`${(column+row)*.8}s`}} />
    </g>))}
    <path d="M-7,-9 L0,-13 L7,-9 M-7,10 L0,14 L7,10" className="fine faint" />
    {[-23,22].map((y,i)=><g key={y}>
      <rect x="-34" y={y-5} width="12" height="10" rx="1" className="surface" />
      <path d={`M-31,${y-1} h6 M-31,${y+2} h3`} className="fine" />
      <circle cx="-37" cy={y} r="1" className="node-activation" style={{animationDelay:`${i}s`}} />
    </g>)}
    {[-24,25].map((y,i)=><g key={y}>
      <rect x="18" y={y-6} width="18" height="12" rx="1.5" className="surface" />
      <path d={`M22,${y} l3,2 l5,-5`} className="fine" />
      <circle cx="33" cy={y+3} r="1" className="node-activation" style={{animationDelay:`${i+2}s`}} />
    </g>)}
    <path d="M-28,32 V38 H27 V31" className="trace" />
    <path d="M-28,32 V38 H27 V31" pathLength="100" className="signal" />
    <path d="M-31,35 L-28,32 L-25,35" className="fine" />
  </g>

  return <g>
    {Array.from({length:7},(_,i)=><g key={i}><path d={`M-30,${-27+i*8} L30,${-16+i*6} M${-30+i*10},-27 L${-30+i*10},23`} className="fine faint" /></g>)}
    <path d="M-26,16 L-14,2 L-21,-14 L3,-21 L17,-5 L25,15 M-14,2 L6,10 L17,-5 M-21,-14 L17,-5" className="trace" />
    <path d="M-26,16 L-14,2 L6,10 L17,-5 L25,15" pathLength="100" className="signal" />
    {[[-26,16],[-14,2],[-21,-14],[3,-21],[17,-5],[6,10],[25,15]].map(([x,y],i)=><g key={x}><circle cx={x} cy={y} r={i===3?4:2.5} className="network-node" /><circle cx={x} cy={y} r="1.1" className="node-activation" style={{animationDelay:`${i*.5}s`}} /></g>)}
    <path d="M-34,-31 V-23 M-34,-31 H-26 M34,27 H26 M34,27 V19" className="fine" />
  </g>
}
