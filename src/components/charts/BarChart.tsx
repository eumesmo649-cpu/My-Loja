import { useState } from 'react'
import { formatBRL, formatCompact } from '@/lib/money'
import { cn } from '@/lib/cn'

export interface BarDatum {
  label: string
  value: number
  /** texto curto exibido no eixo (se omitido, usa label) */
  axis?: string
}

interface BarChartProps {
  data: BarDatum[]
  ariaLabel: string
  /** a cada quantas barras mostrar um rótulo no eixo */
  axisEvery?: number
  height?: number
  className?: string
}

/**
 * Gráfico de barras simples em SVG (sem biblioteca). Responsivo via viewBox,
 * toque/passagem do mouse mostra o valor da barra.
 */
export function BarChart({ data, ariaLabel, axisEvery = 1, height = 180, className }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const W = 640
  const padTop = 22
  const padBottom = 24
  const chartH = height - padTop - padBottom
  const max = Math.max(...data.map((d) => d.value), 0)
  const slot = W / Math.max(data.length, 1)
  const barW = Math.min(28, slot * 0.62)
  const total = data.reduce((a, d) => a + d.value, 0)

  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0)
  const shown = active ?? (total > 0 ? peak : null)

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1 flex min-h-[44px] items-end justify-between">
        {shown !== null && data[shown] ? (
          <div>
            <p className="text-[13px] font-semibold text-muted">{data[shown].label}</p>
            <p className="num text-xl font-bold leading-tight">{formatBRL(data[shown].value)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Sem vendas neste período</p>
        )}
        {max > 0 && <p className="num text-xs text-faint">máx. {formatCompact(max)}</p>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full touch-pan-y select-none"
        onMouseLeave={() => setActive(null)}
      >
        <line x1={0} x2={W} y1={padTop + chartH} y2={padTop + chartH} stroke="var(--color-line)" strokeWidth={1.5} />
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(d.value > 0 ? 3 : 0, (d.value / max) * chartH) : 0
          const x = i * slot + (slot - barW) / 2
          const y = padTop + chartH - h
          const isActive = shown === i
          return (
            <g
              key={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              onTouchStart={() => setActive(i)}
              className="cursor-pointer"
            >
              {/* área de toque generosa */}
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              <rect
                x={x}
                y={d.value > 0 ? y : padTop + chartH - 2}
                width={barW}
                height={d.value > 0 ? h : 2}
                rx={Math.min(6, barW / 2)}
                fill={d.value === 0 ? 'var(--color-line)' : isActive ? 'var(--color-brand-600)' : 'var(--color-brand-200)'}
              />
              {i % axisEvery === 0 && (
                <text x={i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={13} fill="var(--color-muted)">
                  {d.axis ?? d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
