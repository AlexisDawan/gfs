import { Card, CardContent } from "./ui/card";
import { useEffect, useRef } from "react";

export function AdCard() {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Charger le script Google AdSense une seule fois
    if (typeof window !== 'undefined') {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('AdSense error:', err);
      }
    }
  }, []);

  return (
    <Card className="bg-gradient-to-br from-[#6c63ff]/10 to-[#00d4ff]/10 border-[#6c63ff]/40 hover:border-[#6c63ff] transition-all duration-300 h-full flex flex-col relative overflow-hidden">
      {/* Badge "Publicité" */}
      <div className="absolute top-2 right-2 bg-[#6c63ff]/20 backdrop-blur-sm px-2 py-1 rounded-full z-10">
        <span className="text-[#6c63ff] text-[10px] font-semibold">PUBLICITÉ</span>
      </div>
      
      <CardContent className="p-4 flex-1 flex items-center justify-center">
        {/* Google AdSense - Display Ad */}
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', minHeight: '250px', width: '100%' }}
          data-ad-client="ca-pub-7298092107502202"
          data-ad-slot="4919366679"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </CardContent>
    </Card>
  );
}