import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogOut, Crosshair } from "lucide-react";

function LoginScreen() {
  const [mode, setMode] = useState<"user" | "admin">("user");
  const [accessKey, setAccessKey] = useState("");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("device-id");
      if (stored) {
        setDeviceId(stored);
      } else {
        const newId = crypto.randomUUID?.() || `device-${Date.now()}`;
        localStorage.setItem("device-id", newId);
        setDeviceId(newId);
      }
    }
  }, []);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Login bem-sucedido!");
      window.location.reload();
    },
    onError: (error) => toast.error(error.message),
  });

  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      toast.success("Admin login bem-sucedido!");
      localStorage.setItem("admin-mode", "1");
      window.location.reload();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) {
      toast.error("Digite uma chave de acesso");
      return;
    }
    if (mode === "admin") {
      adminLogin.mutate({ adminKey: accessKey });
    } else {
      login.mutate({ accessKey, deviceId });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Crosshair className="text-primary" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            PURPOU<br /><span className="text-primary">SENSI</span>
          </h1>
          <p className="text-muted-foreground">Painel de sensibilidade</p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Acesso {mode === "admin" ? "Administrativo" : "Protegido"}</CardTitle>
            <CardDescription>
              {mode === "admin"
                ? "Digite a chave administrativa"
                : "Digite sua chave de acesso"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {mode === "admin" ? "Chave Admin" : "Chave de Acesso"}
                </label>
                <Input
                  type={mode === "admin" ? "password" : "text"}
                  placeholder={mode === "admin" ? "••••••••" : "SENSI-****-****"}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  disabled={login.isPending || adminLogin.isPending}
                  className="bg-input border-border"
                />
              </div>

              <Button
                type="submit"
                disabled={login.isPending || adminLogin.isPending}
                className="w-full"
              >
                {login.isPending || adminLogin.isPending ? "Validando..." : "Entrar"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMode(mode === "admin" ? "user" : "admin");
                  setAccessKey("");
                }}
              >
                {mode === "admin" ? "Voltar para acesso de usuário" : "Acesso administrativo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Purpou Dev © 2026 • Feito para quem joga sério
        </p>
      </div>
      <Toaster />
    </div>
  );
}

function DashboardPage() {
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem("session-token");
      localStorage.removeItem("admin-mode");
      window.location.reload();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="text-primary" size={24} />
            <span className="font-bold text-foreground">PURPOU SENSI</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout.mutate()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Painel de Controle</CardTitle>
            <CardDescription>Bem-vindo ao seu painel</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Sistema carregado com sucesso!
            </p>
          </CardContent>
        </Card>
      </main>
      <Toaster />
    </div>
  );
}

export default function Home() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  if (me.isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Crosshair className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (me.data) {
    return <DashboardPage />;
  }

  return <LoginScreen />;
}
