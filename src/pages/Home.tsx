import { Construction } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <div className="flex justify-center mb-8">
          <div className="p-6 bg-accent/10 rounded-full">
            <Construction className="h-24 w-24 text-accent" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold mb-4">
          <span className="gradient-text">Comic Vault</span>
        </h1>
        
        <h2 className="text-3xl font-semibold text-foreground">
          Site Under Construction
        </h2>
        
        <p className="text-xl text-muted-foreground">
          We're working hard to bring you the ultimate platform for comic book collectors.
        </p>
        
        <div className="pt-8">
          <p className="text-lg text-muted-foreground">
            The site will be up soon. Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
}
