export const capabilities = [
  { name: 'Create', x: -28, y: -127, port: [0, 27] },
  { name: 'Engineer', x: 118, y: -63, port: [-30, 0] },
  { name: 'Research', x: 116, y: 72, port: [-30, 20] },
  { name: 'Neural', x: 3, y: 139, port: [0, -26] },
  { name: 'Automate', x: -130, y: 54, port: [26, 0] },
  { name: 'Navigate', x: -121, y: -76, port: [25, 15] },
]

const drift = [[-6, 7], [-7, -8], [-7, 5], [7, -6], [6, 7], [-5, 6]]
const smooth = (value: number) => value * value * (3 - 2 * value)

export function compassFrame(seconds: number) {
  // Eleven gentle five-degree adjustments, ending exactly east after 90s.
  const step = Math.min(11, Math.max(0, seconds) / 90 * 11)
  const whole = Math.floor(step)
  const glide = Math.max(0, Math.min(1, (step - whole - .1) / .8))
  const angle = 35 + 5 * (whole + smooth(glide))
  const turn = (angle - 35) * Math.PI / 180
  const nodes = capabilities.map((node, i) => {
    const phase = i * .7
    const wave = (Math.sin(seconds / 17 + phase) - Math.sin(phase)) / 2
    const settle = (1 - Math.cos(seconds / 23)) / 2
    return { ...node,
      x: node.x * Math.cos(turn) - node.y * Math.sin(turn) + drift[i][0] * wave,
      y: node.x * Math.sin(turn) + node.y * Math.cos(turn) + drift[i][1] * settle,
    }
  })
  const terminals = nodes.map(({x,y,port}) => [x+port[0], y+port[1]])
  const routes = terminals.map(([x,y],i) => {
    const [endX,endY] = terminals[(i+1)%terminals.length]
    return `M${x},${y} C${x*.48},${y*.48} ${endX*.48},${endY*.48} ${endX},${endY}`
  })
  return { angle, nodes, routes }
}
