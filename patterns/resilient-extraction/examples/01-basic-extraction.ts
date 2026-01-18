/**
 * Example 01: Basic AI Extraction
 * 
 * This example demonstrates the most basic usage of the framework:
 * 1. Define or use an existing Extractor (Schema + Prompt)
 * 2. Create the Extraction Pipeline
 * 3. Extract items from a text string
 * 
 * ## Run this example:
 * 
 * ```bash
 * export GEMINI_API_KEY=your_key_here
 * npx tsx examples/01-basic-extraction.ts
 * ```
 */

import "dotenv/config";
import { createPipeline } from "../lib/core";
import { EXTRACTORS } from "../lib/extractors";

async function main() {
    console.log("🚀 Starting Basic Extraction Example...");

    // 1. Initialize the pipeline
    // It automatically reads GEMINI_API_KEY from process.env
    const pipeline = createPipeline();

    // 2. Select a built-in extractor (Recipe)
    const recipeExtractor = EXTRACTORS.recipe;

    // 3. Sample input text
    const sampleText = `
    Spicy Tomato Pasta
    
    Ingredients:
    - 200g Spaghetti
    - 2 cloves Garlic, minced
    - 1 jar Marinara Sauce
    - 1 tsp Red Pepper Flakes
    
    Instructions:
    1. Boil water in a large pot.
    2. Cook spaghetti according to package directions.
    3. Sauté garlic in olive oil.
    4. Add sauce and pepper flakes, simmer for 5 mins.
    5. Toss pasta with sauce and serve.
  `;

    try {
        console.log(`\n📄 Extracting data using: ${recipeExtractor.name}`);

        // 4. Run the extraction (Single chunk)
        const recipes = await pipeline.extractSingle(sampleText, recipeExtractor);

        // 5. Output the results
        console.log("\n✅ Extraction Successful!");
        console.log(JSON.stringify(recipes, null, 2));

        if (recipes.length > 0) {
            const recipe = recipes[0];
            console.log(`\n🍴 Title: ${recipe.title}`);
            console.log(`🥦 Ingredients: ${recipe.ingredients.length}`);
            console.log(`📝 Steps: ${recipe.instructions.length}`);
        }

    } catch (error) {
        console.error("\n❌ Extraction Failed:");
        console.error(error);
    }
}

// Run the example
main();
