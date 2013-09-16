class StudioController < ApplicationController
  
  KEYS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l',';'],
    ['z','x','c','v','b','n','m',',','.','/']
  ]
  
  def index
    # Load requested song if exists
   
    # Determine what platform user is on from session
   
    # Determine which view to render based on platform
    
    samples = Sample.find_all_by_description(nil)
    @keys ||= KEYS
    
    @samples = []
    @keys.flatten.each_with_index do |k,i|
      @samples[k.ord] = samples[i];
    end
    
    render 'desktop'
  end
  
  
  
 
end
