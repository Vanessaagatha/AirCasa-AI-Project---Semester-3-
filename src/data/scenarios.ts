import type { DemoScenario } from '@/types'

/** Demo scenarios let a presenter show edge cases without real hardware. */
export const scenarioLabel: Record<DemoScenario, string> = {
  typical: 'Typical day',
  'hot-afternoon': 'Hot spell',
  'rain-incoming': 'Rain incoming',
  'poor-air': 'Poor outdoor air',
  'sensor-offline': 'Sensor offline',
  'model-unavailable': 'Model unavailable',
}

export const scenarioDescription: Record<DemoScenario, string> = {
  typical: 'Synthetic values shaped like a humid tropical day.',
  'hot-afternoon': 'Outdoor temperatures about 3°C above typical for the last day.',
  'rain-incoming': 'A rain band is placed roughly two hours from now.',
  'poor-air': 'Regional PM2.5 roughly doubled for the last two days.',
  'sensor-offline': 'Indoor readings missing for the last three hours.',
  'model-unavailable': 'The prediction service does not respond.',
}
