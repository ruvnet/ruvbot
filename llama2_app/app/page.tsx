// page.tsx
import Header from "@/app/components/header";
import ChatSection from "./components/chat-section";

export default function Home() {
  return (
    // Add `pt-0` to ensure no padding is applied by default on mobile
    // `md:pt-24` applies padding only on medium screens and larger
    <main className="flex min-h-screen flex-col items-center gap-10 pt-0 pb-24 px-4 md:pt-24 md:px-24 background-gradient">
      <Header />
      <ChatSection />
    </main>
  );
}
