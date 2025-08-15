export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  safelist: [{ pattern: /bg-lcars-(gold|blue|amber|slate|copper|brown|red|text)/ }],
  theme: {
    extend: {
      colors: {
        'lcars-amber':  'rgb(var(--lcars-amber) / <alpha-value>)',
        'lcars-gold':   'rgb(var(--lcars-gold)  / <alpha-value>)',
        'lcars-copper': 'rgb(var(--lcars-copper)/ <alpha-value>)',
        'lcars-brown':  'rgb(var(--lcars-brown) / <alpha-value>)',
        'lcars-red':    'rgb(var(--lcars-red)   / <alpha-value>)',
        'lcars-blue':   'rgb(var(--lcars-blue)  / <alpha-value>)',
        'lcars-slate':  'rgb(var(--lcars-slate) / <alpha-value>)',
        'lcars-text':   'rgb(var(--lcars-text)  / <alpha-value>)',
      },
      borderRadius: { lcars: '14px' },
    }
  }
};
