import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { ExternalLink, Sparkles } from "lucide-react";

export function AdCard() {
  return (
    <Card className="bg-gradient-to-br from-[#6c63ff]/10 to-[#00d4ff]/10 border-[#6c63ff]/40 hover:border-[#6c63ff] transition-all duration-300 h-full flex flex-col relative overflow-hidden">
      {/* Badge "Publicité" */}
      <div className="absolute top-4 right-4 bg-[#6c63ff]/20 backdrop-blur-sm px-3 py-1 rounded-full">
        <span className="text-[#6c63ff] text-xs font-semibold">PUBLICITÉ</span>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between">
        {/* En-tête avec icône */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-[#6c63ff]/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-[#6c63ff]" />
            </div>
            <h3 className="text-xl font-bold text-white">Soutenez GoForScrim</h3>
          </div>
          <p className="text-white/70 leading-relaxed">
            Ce site est 100% gratuit et autofinancé. Votre soutien nous aide à maintenir et améliorer la plateforme pour toute la communauté Overwatch.
          </p>
        </div>

        {/* Section CTA */}
        <div className="space-y-3">
          <Button 
            className="w-full bg-gradient-to-r from-[#6c63ff] to-[#00d4ff] hover:opacity-90 text-white border-0 font-semibold"
            onClick={() => window.open('https://www.paypal.com/donate', '_blank')}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Faire un don
          </Button>
          
          <Button 
            variant="outline"
            className="w-full border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10"
            onClick={() => window.open('/support', '_self')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Nous contacter
          </Button>
          
          <p className="text-white/50 text-xs text-center mt-2">
            Merci pour votre soutien ! 💙
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
