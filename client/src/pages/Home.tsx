import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("login");

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">PURPOU SENSI</h1>
          <p className="text-muted-foreground">Gerador de sensibilidade</p>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-lg border border-border">
          <div className="flex gap-2 mb-6 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                activeTab === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                activeTab === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin
            </button>
          </div>

          {activeTab === "login" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Access Key
                </label>
                <input
                  type="text"
                  placeholder="Digite sua chave de acesso"
                  className="w-full px-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                Entrar
              </button>
            </div>
          )}

          {activeTab === "admin" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Admin Key
                </label>
                <input
                  type="password"
                  placeholder="Digite a chave de administrador"
                  className="w-full px-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                Admin Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
