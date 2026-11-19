import type { ApiConfig, GenerationSnapshot, RecipeState } from '@/types/gallery'
import { durableRecipe } from './persistentImages'
export { durableImage } from './persistentImages'

export async function snapshotGeneration(recipe: RecipeState, config: ApiConfig, prompt: string): Promise<GenerationSnapshot> {
  const { providers, promptEnhancer, ...settings } = structuredClone(config)
  const safeSettings: GenerationSnapshot['settings'] = { ...settings, promptEnhancer: { baseUrl: promptEnhancer.baseUrl, model: promptEnhancer.model } }
  const models = Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, {model: value.model, customModel: value.customModel}])) as GenerationSnapshot['models']
  return {recipe: await durableRecipe(recipe), prompt, settings: safeSettings, models}
}
