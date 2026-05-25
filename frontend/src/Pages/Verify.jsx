// Verify.jsx - Updated to get userId from localStorage
import React, { useContext, useEffect } from "react";
import { ShopContext } from "../context/ShopContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";

const VerifyPayment = () => {
  const { backendUrl, token, setCartItems } = useContext(ShopContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const success = searchParams.get("success");
  const orderId = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!token) {
        toast.error("Please login to verify payment");
        navigate('/cart');
        return;
      }

      // Get userId from localStorage (stored during login)
      const userId = localStorage.getItem("userId");
      
      if (!userId) {
        toast.error("User ID not found. Please login again.");
        navigate('/cart');
        return;
      }

      if (success === "true" && orderId && sessionId) {
        try {
          const response = await axios.post(
            `${backendUrl}/api/order/verifystripe`,
            {
              success: "true",
              orderId,
              userId: userId,
              sessionId
            },
            { headers: { token } }
          );

          if (response.data.success) {
            toast.success("Payment successful! Order placed.");
            setCartItems({});
            setTimeout(() => navigate('/orders'), 2000);
          } else {
            toast.error(response.data.message || "Payment verification failed");
            setTimeout(() => navigate('/cart'), 2000);
          }
        } catch (error) {
          console.error(error);
          toast.error("Payment verification failed");
          setTimeout(() => navigate('/cart'), 2000);
        }
      } else if (success === "false") {
        toast.error("Payment cancelled or failed");
        setTimeout(() => navigate('/cart'), 2000);
      } else {
        navigate('/cart');
      }
    };

    verifyPayment();
  }, [success, orderId, sessionId, token, navigate, backendUrl, setCartItems]);

  return (
    <div className='flex flex-col items-center justify-center min-h-screen'>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Verifying your payment...</p>
      </div>
    </div>
  );
};

export default VerifyPayment;