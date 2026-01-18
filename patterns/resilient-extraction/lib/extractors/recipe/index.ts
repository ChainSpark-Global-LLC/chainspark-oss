/**
 * Recipe Extractor
 * 
 * Extracts structured recipe data from cooking blogs and recipe pages:
 * - Ingredients with quantities
 * - Step-by-step instructions
 * - Prep/cook time estimates
 */

import { z } from "zod";
import { ExtractorConfig } from "../../core";

/**
 * Schema for an ingredient
 */
export const IngredientSchema = z.object({
    name: z.string().describe("Name of the ingredient"),
    quantity: z.string().nullable().describe("Amount needed (e.g., '2 cups', '1 tbsp')"),
    preparation: z.string().nullable().describe("Preparation notes (e.g., 'diced', 'melted')"),
});

/**
 * Schema for a recipe step
 */
export const RecipeStepSchema = z.object({
    step_number: z.number().describe("Step number (1-indexed)"),
    instruction: z.string().describe("The instruction for this step"),
    duration_minutes: z.number().nullable().describe("Estimated time for this step in minutes"),
});

/**
 * Schema for a complete recipe
 */
export const RecipeSchema = z.object({
    title: z.string().describe("Recipe title"),
    servings: z.number().nullable().describe("Number of servings"),
    prep_time_minutes: z.number().nullable().describe("Preparation time in minutes"),
    cook_time_minutes: z.number().nullable().describe("Cooking time in minutes"),
    ingredients: z.array(IngredientSchema).describe("List of ingredients"),
    steps: z.array(RecipeStepSchema).describe("Cooking instructions"),
    confidence: z.number().min(0).max(1).describe("Extraction confidence (0-1)"),
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

/**
 * Build the extraction prompt for recipes
 */
export function buildPrompt(text: string): string {
    return `You are an expert at extracting structured recipe data from cooking websites and recipe pages.

Extract the recipe information from this text. Be thorough and extract:
- title: The recipe name
- servings: Number of servings (null if not specified)
- prep_time_minutes: Prep time in minutes (null if not specified)
- cook_time_minutes: Cook time in minutes (null if not specified)
- ingredients: Array of ingredients with:
  - name: Ingredient name
  - quantity: Amount like "2 cups" or "1/2 tsp" (null if not specified)
  - preparation: Notes like "diced" or "room temperature" (null if not specified)
- steps: Array of numbered instructions with:
  - step_number: 1, 2, 3, etc.
  - instruction: The full instruction text
  - duration_minutes: Estimated time for this step (null if not specified)
- confidence: Your confidence in the overall extraction (0.0 to 1.0)

IMPORTANT:
- Extract ALL ingredients, even garnishes
- Keep instructions as separate steps, don't combine them
- Parse time values to minutes (e.g., "1 hour" = 60)
- If the text contains multiple recipes, extract only the main one

RECIPE TEXT:
${text}`;
}

/**
 * Recipe extractor configuration
 */
export const recipeExtractor: ExtractorConfig<typeof RecipeSchema> = {
    name: "recipe",
    description: "Extract structured data from recipes",
    schema: RecipeSchema,
    buildPrompt,
};

export default recipeExtractor;
