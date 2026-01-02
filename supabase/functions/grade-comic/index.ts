import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GradingRequest {
  request_id: string;
  user_id: string;
  image_urls: string[];
  condition_notes?: string;
}

interface GradingResult {
  grade: number;
  value_estimate: number;
  condition_analysis: string;
  subgrades: {
    cover: number;
    spine: number;
    pages: number;
    final: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: GradingRequest = await req.json();
    const { request_id, user_id, image_urls, condition_notes } = body;

    console.log('Processing grading request:', request_id);

    // Validate input
    if (!request_id || !user_id || !image_urls || image_urls.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate realistic grading results
    // In a real implementation, this would use AI vision analysis
    const result = generateGradingResult(condition_notes);

    // Update grading request in database
    const { error: updateError } = await supabase
      .from('grading_requests')
      .update({
        grade_result: result.grade,
        value_estimate: result.value_estimate,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', request_id);

    if (updateError) {
      console.error('Error updating grading request:', updateError);
      throw new Error('Failed to update grading request');
    }

    console.log('Grading completed successfully:', request_id);

    return new Response(
      JSON.stringify({
        success: true,
        result: result
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in grade-comic function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Generate realistic grading results based on condition notes
 * In production, this would use AI vision analysis
 */
function generateGradingResult(conditionNotes?: string): GradingResult {
  // Base grade range based on condition notes
  let baseGrade = 8.0;
  let variance = 1.5;

  if (conditionNotes) {
    const notes = conditionNotes.toLowerCase();
    
    // Adjust grade based on keywords
    if (notes.includes('mint') || notes.includes('perfect') || notes.includes('pristine')) {
      baseGrade = 9.5;
      variance = 0.5;
    } else if (notes.includes('excellent') || notes.includes('near mint')) {
      baseGrade = 9.0;
      variance = 0.8;
    } else if (notes.includes('good') || notes.includes('fine')) {
      baseGrade = 7.5;
      variance = 1.0;
    } else if (notes.includes('wear') || notes.includes('damage') || notes.includes('torn')) {
      baseGrade = 6.0;
      variance = 1.5;
    } else if (notes.includes('poor') || notes.includes('heavily worn')) {
      baseGrade = 4.0;
      variance = 1.0;
    }
  }

  // Generate random grade within variance
  const randomOffset = (Math.random() - 0.5) * variance;
  const finalGrade = Math.max(1.0, Math.min(10.0, baseGrade + randomOffset));

  // Generate subgrades (slightly varied from final grade)
  const coverGrade = Math.max(1.0, Math.min(10.0, finalGrade + (Math.random() - 0.5) * 0.5));
  const spineGrade = Math.max(1.0, Math.min(10.0, finalGrade + (Math.random() - 0.5) * 0.5));
  const pagesGrade = Math.max(1.0, Math.min(10.0, finalGrade + (Math.random() - 0.5) * 0.5));

  // Calculate value estimate based on grade
  // Higher grades = exponentially higher values
  const baseValue = 50;
  const gradeMultiplier = Math.pow(finalGrade / 5, 2);
  const valueEstimate = Math.round(baseValue * gradeMultiplier * (1 + Math.random() * 0.5));

  // Generate condition analysis
  const conditionAnalysis = generateConditionAnalysis(finalGrade, conditionNotes);

  return {
    grade: Math.round(finalGrade * 10) / 10,
    value_estimate: valueEstimate,
    condition_analysis: conditionAnalysis,
    subgrades: {
      cover: Math.round(coverGrade * 10) / 10,
      spine: Math.round(spineGrade * 10) / 10,
      pages: Math.round(pagesGrade * 10) / 10,
      final: Math.round(finalGrade * 10) / 10
    }
  };
}

/**
 * Generate condition analysis text based on grade
 */
function generateConditionAnalysis(grade: number, notes?: string): string {
  let analysis = '';

  if (grade >= 9.5) {
    analysis = 'Gem Mint condition. Nearly perfect with only minor printing defects allowed. Exceptional eye appeal.';
  } else if (grade >= 9.0) {
    analysis = 'Mint condition. Nearly perfect with minimal wear. Excellent eye appeal and structural integrity.';
  } else if (grade >= 8.0) {
    analysis = 'Very Fine condition. Above average with minor wear visible. Good eye appeal and solid structure.';
  } else if (grade >= 7.0) {
    analysis = 'Fine condition. Average wear consistent with age. Acceptable eye appeal with some visible defects.';
  } else if (grade >= 6.0) {
    analysis = 'Good condition. Moderate wear and handling marks. Below average eye appeal but complete.';
  } else if (grade >= 4.0) {
    analysis = 'Fair condition. Significant wear and defects. Poor eye appeal but structurally intact.';
  } else {
    analysis = 'Poor condition. Heavy wear, major defects, and structural issues. Minimal collectible value.';
  }

  if (notes) {
    analysis += ` User notes: ${notes}`;
  }

  return analysis;
}
