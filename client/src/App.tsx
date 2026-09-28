import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PreviewGate from "./components/PreviewGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Admin from "./pages/Admin";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/produk/:id" component={ProductDetail} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><PreviewGate><CartProvider><Router /></CartProvider></PreviewGate></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
