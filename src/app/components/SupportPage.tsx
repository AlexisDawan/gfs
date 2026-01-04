import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

export function SupportPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "",
    customSubject: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const requestTypes = [
    { value: "bug", label: "Signaler un bug" },
    { value: "feature", label: "Suggérer une fonctionnalité" },
    { value: "question", label: "Poser une question" },
    { value: "other", label: "Autre" },
  ];

  // Validation en temps réel
  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case "name":
        if (!value.trim()) {
          newErrors.name = "Le nom est requis";
        } else {
          delete newErrors.name;
        }
        break;

      case "email":
        if (!value.trim()) {
          newErrors.email = "L'email est requis";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = "Email invalide";
        } else {
          delete newErrors.email;
        }
        break;

      case "type":
        if (!value) {
          newErrors.type = "Veuillez sélectionner un type de demande";
        } else {
          delete newErrors.type;
        }
        break;

      case "customSubject":
        if (formData.type === "other" && !value.trim()) {
          newErrors.customSubject = "Le sujet est requis pour 'Autre'";
        } else {
          delete newErrors.customSubject;
        }
        break;

      case "message":
        if (!value.trim()) {
          newErrors.message = "Le message est requis";
        } else if (value.length > 1000) {
          newErrors.message = "Le message ne peut pas dépasser 1000 caractères";
        } else {
          delete newErrors.message;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation complète
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Le nom est requis";
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email invalide";
    }
    if (!formData.type) newErrors.type = "Veuillez sélectionner un type de demande";
    if (formData.type === "other" && !formData.customSubject.trim()) {
      newErrors.customSubject = "Le sujet est requis pour 'Autre'";
    }
    if (!formData.message.trim()) {
      newErrors.message = "Le message est requis";
    } else if (formData.message.length > 1000) {
      newErrors.message = "Le message ne peut pas dépasser 1000 caractères";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Préparer les données pour le backend
      const typeLabel = requestTypes.find((t) => t.value === formData.type)?.label || formData.type;
      const subject = formData.type === "other" ? formData.customSubject : typeLabel;

      console.log("📤 Sending contact form to backend...", {
        name: formData.name,
        email: formData.email,
        type: formData.type,
        subject,
        messageLength: formData.message.length,
      });

      // Envoyer vers le backend qui transmettra à Discord
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          type: formData.type,
          subject: subject,
          message: formData.message,
        }),
      });

      console.log("📥 Backend response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Backend error:", error);
        throw new Error(error.error || "Erreur lors de l'envoi du message");
      }

      const result = await response.json();
      console.log("✅ Backend response:", result);

      // Réinitialiser le formulaire
      setFormData({
        name: "",
        email: "",
        type: "",
        customSubject: "",
        message: "",
      });
      setErrors({});

      // Afficher modal de succès
      setShowSuccessModal(true);
    } catch (error) {
      console.error("❌ Error:", error);
      setErrors({
        submit: "Une erreur est survenue. Veuillez réessayer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#0d1b2a] to-[#0a0e27] border-b-2 border-[#00d4ff]/30 py-16 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Support & Contact</h1>
          <p className="text-white/60 text-lg">
            Une question, un bug ou une suggestion ? Nous sommes là pour vous aider !
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <form
          onSubmit={handleSubmit}
          className="bg-[#0d1b2a] border border-[#00d4ff]/20 rounded-lg p-8 space-y-6"
        >
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Nom <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={(e) => validateField("name", e.target.value)}
              placeholder="Votre nom"
              className={`bg-[#0a0e27] border-[#00d4ff]/20 text-white placeholder:text-white/40 focus:border-[#00d4ff] ${
                errors.name ? "border-red-400" : ""
              }`}
            />
            {errors.name && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.name}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={(e) => validateField("email", e.target.value)}
              placeholder="votre@email.com"
              className={`bg-[#0a0e27] border-[#00d4ff]/20 text-white placeholder:text-white/40 focus:border-[#00d4ff] ${
                errors.email ? "border-red-400" : ""
              }`}
            />
            {errors.email && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.email}</span>
              </div>
            )}
          </div>

          {/* Type de demande */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-white">
              Type de demande <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange("type", value)}
            >
              <SelectTrigger
                className={`bg-[#0a0e27] border-[#00d4ff]/20 text-white focus:border-[#00d4ff] ${
                  errors.type ? "border-red-400" : ""
                }`}
              >
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1b2a] border-[#00d4ff]/30 text-white">
                {requestTypes.map((type) => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                    className="focus:bg-[#00d4ff]/20 focus:text-white"
                  >
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.type}</span>
              </div>
            )}
          </div>

          {/* Sujet personnalisé (affiché si "Autre" est sélectionné) */}
          {formData.type === "other" && (
            <div className="space-y-2">
              <Label htmlFor="customSubject" className="text-white">
                Sujet <span className="text-red-400">*</span>
              </Label>
              <Input
                id="customSubject"
                type="text"
                value={formData.customSubject}
                onChange={(e) => handleChange("customSubject", e.target.value)}
                onBlur={(e) => validateField("customSubject", e.target.value)}
                placeholder="Décrivez brièvement votre demande"
                className={`bg-[#0a0e27] border-[#00d4ff]/20 text-white placeholder:text-white/40 focus:border-[#00d4ff] ${
                  errors.customSubject ? "border-red-400" : ""
                }`}
              />
              {errors.customSubject && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.customSubject}</span>
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-white">
              Message <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleChange("message", e.target.value)}
              onBlur={(e) => validateField("message", e.target.value)}
              placeholder="Décrivez votre demande en détail..."
              className={`bg-[#0a0e27] border-[#00d4ff]/20 text-white placeholder:text-white/40 focus:border-[#00d4ff] min-h-[200px] resize-none ${
                errors.message ? "border-red-400" : ""
              }`}
              maxLength={1000}
            />
            <div className="flex items-center justify-between text-sm">
              <div>
                {errors.message && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.message}</span>
                  </div>
                )}
              </div>
              <span
                className={`${
                  formData.message.length > 1000 ? "text-red-400" : "text-white/40"
                }`}
              >
                {formData.message.length} / 1000
              </span>
            </div>
          </div>

          {/* Erreur globale */}
          {errors.submit && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg p-4">
              <AlertCircle className="w-5 h-5" />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Bouton d'envoi */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#6c63ff] hover:bg-[#6c63ff]/80 text-white px-8 py-6 text-lg border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Envoyer le message
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Modal de succès */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-[#0d1b2a] border-2 border-[#00d4ff]/30 text-white">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-400/20 border-2 border-green-400 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl text-white">
              Message envoyé !
            </DialogTitle>
            <DialogDescription className="text-center text-white/70 text-lg">
              Merci pour votre message. Notre équipe vous répondra dans les plus brefs
              délais.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                navigate("/");
              }}
              className="flex-1 bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-[#0a0e27] border-0"
            >
              Retour à l'accueil
            </Button>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="flex-1 bg-[#6c63ff] hover:bg-[#6c63ff]/80 text-white border-0"
            >
              Rester ici
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}