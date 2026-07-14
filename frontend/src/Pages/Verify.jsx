// Verify.jsx - handles the redirect-back callback for both Stripe and Paystack
import React, { useContext, useEffect } from "react";
import { ShopContext } from "../context/ShopContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";

const VerifyPayment = () => {
  const { backendUrl, token, setCartItems } = useContext(ShopContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get("orderId");

  const success = searchParams.get("success");
  const sessionId = searchParams.get("session_id");


  const reference = searchParams.get("reference");
  const trxref = searchParams.get("trxref");

  useEffect(() => {
    const handleResult = (response, successMessage) => {
      if (response.data.success) {
        toast.success(successMessage);
        setCartItems({});
        setTimeout(() => navigate("/orders"), 2000);
      } else {
        toast.error(response.data.message || "Payment verification failed");
        setTimeout(() => navigate("/cart"), 2000);
      }
    };

    const verifyPayment = async () => {
      if (!token) {
        toast.error("Please login to verify payment");
        navigate("/cart");
        return;
      }

   
      const userId = localStorage.getItem("userId");

      if (!userId) {
        toast.error("User ID not found. Please login again.");
        navigate("/cart");
        return;
      }

      try {
        if (reference || trxref) {

          const response = await axios.post(
            `${backendUrl}/api/order/verifypaystack`,
            {
              orderId,
              reference: reference || trxref,
              userId,
            },
            { headers: { token } }
          );
          handleResult(response, "Payment successful! Order placed.");
        } else if (success === "true" && orderId && sessionId) {

          const response = await axios.post(
            `${backendUrl}/api/order/verifystripe`,
            {
              success: "true",
              orderId,
              userId,
              sessionId,
            },
            { headers: { token } }
          );
          handleResult(response, "Payment successful! Order placed.");
        } else if (success === "false") {
          toast.error("Payment cancelled or failed");
          setTimeout(() => navigate("/cart"), 2000);
        } else {
          navigate("/cart");
        }
      } catch (error) {
        console.error(error);
        toast.error("Payment verification failed");
        setTimeout(() => navigate("/cart"), 2000);
      }
    };

    verifyPayment();
  }, [success, orderId, sessionId, reference, trxref, token, navigate, backendUrl, setCartItems]);

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