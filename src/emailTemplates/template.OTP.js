

export const getOTPEmailTemplate = (otpCode) => {
  const subject = "Código de seguridad de AgroHuracán";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #171318; border-radius: 12px; overflow: hidden;">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- AgroHuracan Icon -->
                 <img
  src="https://agroappfjb.netlify.app/LogoApp-AgroHuracan-desktop.png"
  alt="AgroHuracán"
  style="
    width: 140px;
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
  "
/>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <span style="color: #ffffff; font-size: 24px; font-weight: bold;">Agro</span><span style="color: #d92727; font-size: 24px; font-weight: bold;">Huracán</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <p style="color: #a1a1aa; font-size: 16px; margin: 0 0 24px 0;">
                Tu código OTP es:
              </p>
              <p style="color: #ffffff; font-size: 48px; font-weight: bold; margin: 0; letter-spacing: 8px;">
                ${otpCode}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; border-top: 1px solid #2a2a2a;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">
                Este código expira en 10 minutos.
              </p>
              <p style="color: #71717a; font-size: 12px; margin: 8px 0 0 0;">
                Si no solicitaste este código, ignora este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}