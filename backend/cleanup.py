from supabase_client import get_supabase_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def cleanup_all_presets():
    """Delete all presets and their associated images from both Supabase and storage."""
    try:
        # Initialize Supabase client
        supabase = get_supabase_client()
        
        # Get all presets
        presets = supabase.table('presets').select('*').execute()
        
        # Delete each preset and its associated files
        for preset in presets.data:
            try:
                # Delete from storage first
                if preset.get('image_path'):
                    supabase.storage.from_('presets').remove([preset['image_path']])
                if preset.get('preset_path'):
                    supabase.storage.from_('presets').remove([preset['preset_path']])
                
                # Delete from database
                supabase.table('presets').delete().eq('id', preset['id']).execute()
                print(f"Successfully deleted preset {preset['id']}")
            except Exception as e:
                print(f"Error deleting preset {preset['id']}: {str(e)}")
        
        print("Cleanup completed successfully")
        
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")

if __name__ == "__main__":
    cleanup_all_presets()
