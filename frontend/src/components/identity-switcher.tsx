import * as React from "react";
import { 
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  toast,
} from "tentix-ui";
import { Settings, User, RefreshCw, Check, X } from "lucide-react";
import { useAuth } from "@hook/use-local-user";

// User roles from server constants
const userRoles = [
  "system",
  "customer", 
  "agent",
  "technician",
  "admin",
  "ai",
] as const;

type UserRole = typeof userRoles[number];

interface IdentitySwitcherProps {
  className?: string;
}

export default function IdentitySwitcher({ className }: IdentitySwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [userId, setUserId] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<UserRole>("customer");
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentToken, setCurrentToken] = React.useState<string | null>(null);
  
  const { user, isAuthenticated } = useAuth();

  React.useEffect(() => {
    setCurrentToken(window.localStorage.getItem("token"));
  }, []);

  const handleSwitchIdentity = async () => {
    if (!userId.trim()) {
      toast({
        title: "Please enter a user ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call playground signToken API
      const formData = new FormData();
      formData.append("userId", userId.trim());
      formData.append("role", selectedRole);

      const response = await fetch(`/api/playground/signToken`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Set token to localStorage
        window.localStorage.setItem("token", data.token);
        setCurrentToken(data.token);
        
        toast({
          title: `Successfully switched to user ${userId} with role ${selectedRole}`,
        });
        
        // Refresh the page to update the auth context
        window.location.reload();
      } else {
        throw new Error("Failed to generate token");
      }
    } catch (error) {
      console.error("Error switching identity:", error);
      toast({
        title: "Failed to switch identity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearToken = () => {
    window.localStorage.removeItem("token");
    setCurrentToken(null);
    toast({
      title: "Token cleared successfully",
    });
    window.location.reload();
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-4 right-4 z-50 shadow-lg hover:shadow-xl transition-shadow"
          >
            <Settings className="h-4 w-4 mr-2" />
            Identity Switcher
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Identity Switcher
            </DialogTitle>
            <DialogDescription>
              Switch user identity for testing purposes. This is only available in development mode.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isAuthenticated && user ? (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">User ID: {user.id}</p>
                      <p className="text-sm text-muted-foreground">Name: {user.name || "Unknown"}</p>
                    </div>
                    <Badge className="bg-gray-100 text-gray-800">
                      {user.role}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not authenticated</p>
                )}
                
                {currentToken && (
                  <div className="mt-3 p-2 bg-muted rounded text-xs font-mono break-all">
                    Token: {currentToken.substring(0, 20)}...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Switch Identity Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Switch Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    type="number"
                    placeholder="Enter user ID (e.g., 1, 2, 3...)"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {userRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <span className="capitalize">{role}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleSwitchIdentity} 
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Switch Identity
                      </>
                    )}
                  </Button>
                  
                  {currentToken && (
                    <Button 
                      variant="destructive" 
                      onClick={handleClearToken}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Token
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Role Descriptions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Role Descriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div><strong>Customer:</strong> Regular user who can create and view tickets</div>
                  <div><strong>Agent:</strong> Support agent who can handle customer tickets</div>
                  <div><strong>Technician:</strong> Technical staff with advanced permissions</div>
                  <div><strong>Admin:</strong> Administrator with full system access</div>
                  <div><strong>System:</strong> System-level operations</div>
                  <div><strong>AI:</strong> AI assistant role</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 