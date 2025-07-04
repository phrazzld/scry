export function TechnicalDiagram() {
  return (
    <svg 
      className="technical-diagram"
      viewBox="0 0 400 300" 
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="diagramTitle diagramDesc"
    >
      <title id="diagramTitle">Quiz System Architecture</title>
      <desc id="diagramDesc">A technical diagram showing the flow of data through the quiz system</desc>
      
      {/* Grid background */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {/* Main components */}
      <g>
        {/* User Input Box */}
        <rect x="40" y="40" width="120" height="60" rx="2" />
        <text x="100" y="75" textAnchor="middle" className="font-mono text-sm">USER INPUT</text>
        
        {/* AI Model Box */}
        <rect x="240" y="40" width="120" height="60" rx="2" />
        <text x="300" y="75" textAnchor="middle" className="font-mono text-sm">AI MODEL</text>
        
        {/* Database Box */}
        <rect x="140" y="160" width="120" height="60" rx="2" />
        <text x="200" y="195" textAnchor="middle" className="font-mono text-sm">DATABASE</text>
        
        {/* Arrows */}
        <path d="M 160 70 L 240 70" markerEnd="url(#arrowhead)" />
        <path d="M 300 100 L 300 140 L 260 160" markerEnd="url(#arrowhead)" />
        <path d="M 140 190 L 100 190 L 100 100" markerEnd="url(#arrowhead)" />
      </g>
      
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#2563EB" />
        </marker>
      </defs>
      
      {/* Labels */}
      <g className="font-mono" fontSize="10">
        <text x="200" y="60" textAnchor="middle" fill="#6B7280">topic</text>
        <text x="280" y="130" textAnchor="middle" fill="#6B7280">questions</text>
        <text x="120" y="150" textAnchor="middle" fill="#6B7280">progress</text>
      </g>
    </svg>
  )
}

export function SpacedRepetitionDiagram() {
  // Calculate exponential decay curves
  const generateCurvePoints = (startX: number, startY: number, tau: number, length: number) => {
    const points = []
    for (let i = 0; i <= length; i += 2) {
      const t = i / 10 // Scale to days
      const y = startY * Math.exp(-t / tau)
      points.push(`${startX + i},${150 - y}`)
    }
    return points.join(' ')
  }

  return (
    <svg 
      className="technical-diagram"
      viewBox="0 0 400 200" 
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="srDiagramTitle srDiagramDesc"
    >
      <title id="srDiagramTitle">The Forgetting Curve with Spaced Repetition</title>
      <desc id="srDiagramDesc">A graph showing how memory retention decays over time and how spaced reviews restore it</desc>
      
      {/* Grid */}
      <defs>
        <pattern id="graphGrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect x="50" y="30" width="300" height="120" fill="url(#graphGrid)" />
      
      {/* Axes */}
      <line x1="50" y1="150" x2="350" y2="150" stroke="#111827" strokeWidth="2" />
      <line x1="50" y1="150" x2="50" y2="30" stroke="#111827" strokeWidth="2" />
      
      {/* Y-axis labels (retention percentage) */}
      <g className="font-mono" fontSize="9" fill="#6B7280">
        <text x="35" y="33" textAnchor="end">100%</text>
        <text x="35" y="63" textAnchor="end">75%</text>
        <text x="35" y="93" textAnchor="end">50%</text>
        <text x="35" y="123" textAnchor="end">25%</text>
        <text x="35" y="153" textAnchor="end">0%</text>
      </g>
      
      {/* X-axis labels (days) */}
      <g className="font-mono" fontSize="9" fill="#6B7280">
        <text x="50" y="165" textAnchor="middle">0</text>
        <text x="110" y="165" textAnchor="middle">1</text>
        <text x="170" y="165" textAnchor="middle">3</text>
        <text x="230" y="165" textAnchor="middle">7</text>
        <text x="290" y="165" textAnchor="middle">14</text>
        <text x="350" y="165" textAnchor="middle">30</text>
      </g>
      
      {/* Forgetting curves */}
      {/* First curve - steepest decay */}
      <polyline 
        points={generateCurvePoints(50, 120, 0.8, 60)}
        fill="none" 
        stroke="#2563EB"
        strokeWidth="2"
      />
      
      {/* Review point 1 at day 1 */}
      <line x1="110" y1="108" x2="110" y2="150" stroke="#2563EB" strokeDasharray="2,2" strokeWidth="1" />
      <circle cx="110" cy="108" r="4" fill="#2563EB" />
      
      {/* Second curve - slower decay */}
      <polyline 
        points={generateCurvePoints(110, 108, 1.5, 60)}
        fill="none" 
        stroke="#2563EB"
        strokeWidth="2"
      />
      
      {/* Review point 2 at day 3 */}
      <line x1="170" y1="85" x2="170" y2="150" stroke="#2563EB" strokeDasharray="2,2" strokeWidth="1" />
      <circle cx="170" cy="85" r="4" fill="#2563EB" />
      
      {/* Third curve - even slower decay */}
      <polyline 
        points={generateCurvePoints(170, 108, 2.5, 60)}
        fill="none" 
        stroke="#2563EB"
        strokeWidth="2"
      />
      
      {/* Review point 3 at day 7 */}
      <line x1="230" y1="75" x2="230" y2="150" stroke="#2563EB" strokeDasharray="2,2" strokeWidth="1" />
      <circle cx="230" cy="75" r="4" fill="#2563EB" />
      
      {/* Fourth curve - slowest decay */}
      <polyline 
        points={generateCurvePoints(230, 108, 4, 120)}
        fill="none" 
        stroke="#2563EB"
        strokeWidth="2"
      />
      
      {/* Axis labels */}
      <g className="font-mono" fontSize="10">
        <text x="25" y="15" fill="#111827" fontWeight="bold">RETENTION</text>
        <text x="340" y="185" fill="#111827" fontWeight="bold">DAYS</text>
      </g>
      
      {/* Review annotations */}
      <g className="font-mono" fontSize="8" fill="#6B7280">
        <text x="110" y="102" textAnchor="middle">REVIEW 1</text>
        <text x="170" y="79" textAnchor="middle">REVIEW 2</text>
        <text x="230" y="69" textAnchor="middle">REVIEW 3</text>
      </g>
    </svg>
  )
}